// dfs_cutting_solver.ts

import { StockCutPlan, CutSummary, CutResult } from "./cutting_stock_types";


export function solveCuttingProblemWithDFS(
    stockLengths: number[],
    stockCounts: number[],
    orderLengths: number[],
    orderCounts: number[],
    cutWidth: number,
    timeLimit: number = 10000,
    maxIterations: number = 1000000
): CutResult {
    // 展开原料数组
    const stockPool: number[] = [];
    for (let i = 0; i < stockLengths.length; i++) {
        for (let j = 0; j < stockCounts[i]; j++) {
            stockPool.push(stockLengths[i]);
        }
    }

    const orderPool: number[] = [];
    for (let i = 0; i < orderLengths.length; i++) {
        for (let j = 0; j < orderCounts[i]; j++) {
            orderPool.push(orderLengths[i]);
        }
    }

    if (stockPool.length === 0 || orderPool.length === 0) {
        return {
            plans: [],
            summary: {
                totalStockUsed: 0,
                totalCutLoss: 0,
                totalWaste: 0,
                isOrderFulfilled: false
            }
        };
    }

    const solver = new DFSStockCuttingSolver(stockPool, orderPool, cutWidth, timeLimit, maxIterations);

    try {
        const solution = solver.solve();

        const groupedMap: Map<string, StockCutPlan> = new Map();
        for (const stock of solution.usedStocks) {
            const countMap: Map<number, number> = new Map();
            for (const c of stock.cuts) countMap.set(c, (countMap.get(c) || 0) + 1);

            const cutLengths = [...countMap.keys()].sort((a, b) => b - a);
            const cutCounts = cutLengths.map(len => countMap.get(len) || 0);

            const cutsKey = cutLengths
                .map((len, idx) => (cutCounts[idx] > 1 ? `${len}*${cutCounts[idx]}` : `${len}`))
                .join('+');

            const key = `${stock.stockLength}_${cutsKey}`;
            const existing = groupedMap.get(key);

            if (existing) {
                existing.count++;
                existing.totalWaste += stock.waste;
                existing.avgWaste = existing.totalWaste / existing.count;
            } else {
                groupedMap.set(key, {
                    stockLength: stock.stockLength,
                    cutLengths: cutLengths,
                    cutCounts: cutCounts,
                    count: 1,
                    totalWaste: stock.waste,
                    avgWaste: stock.waste
                });
            }
        }

        const verification = solver.verifySolution(solution);

        return {
            plans: Array.from(groupedMap.values()),
            summary: {
                totalStockUsed: solution.totalStocksUsed,
                totalCutLoss: verification.totalCutWaste,
                totalWaste: solution.totalWaste,
                isOrderFulfilled: verification.isValid
            }
        };
    } catch (_) {
        return {
            plans: [],
            summary: {
                totalStockUsed: 0,
                totalCutLoss: 0,
                totalWaste: 0,
                isOrderFulfilled: false
            }
        };
    }
}


/**
 * 一维下料问题求解器 - 使用DFS和剪枝策略
 * 优化目标：1. 最小化原材料使用数量 2. 最小化废料
 */

interface StockUsage {
    stockLength: number;  // 原料长度
    cuts: number[];       // 切割尺寸列表
    waste: number;        // 剩余废料
}

interface Solution {
    usedStocks: StockUsage[];  // 使用的原料
    totalWaste: number;        // 总废料
    totalStocksUsed: number;   // 使用的原料总数
}

class DFSStockCuttingSolver {
    private stockLengths: number[];    // 原料长度数组
    private orderLengths: number[];    // 订单长度数组
    private cutWidth: number;          // 切割宽度
    private bestSolution: Solution;    // 最优解
    private visited: Set<string>;      // 已访问状态集合(用于剪枝)
    private timeLimit: number;         // 时间限制(毫秒)
    private startTime: number;         // 开始时间
    private maxIterations: number;     // 最大迭代次数
    private iterationCount: number;    // 迭代计数器

    /**
     * 初始化求解器
     *
     * @param stockLengths 原料长度数组
     * @param orderLengths 订单长度数组
     * @param cutWidth 切割宽度
     * @param timeLimit 时间限制(毫秒)，默认为10秒
     * @param maxIterations 最大迭代次数，默认为100万次
     */
    constructor(
        stockLengths: number[],
        orderLengths: number[],
        cutWidth: number = 0,
        timeLimit: number = 10000,
        maxIterations: number = 1000000
    ) {
        this.stockLengths = [...stockLengths].sort((a, b) => b - a);  // 从大到小排序
        this.orderLengths = [...orderLengths].sort((a, b) => b - a);  // 从大到小排序
        this.cutWidth = cutWidth;
        this.timeLimit = timeLimit;
        this.maxIterations = maxIterations;
        this.iterationCount = 0;

        // 初始化最优解为无穷大
        this.bestSolution = {
            usedStocks: [],
            totalWaste: Infinity,
            totalStocksUsed: Infinity
        };

        this.visited = new Set<string>();
    }

    /**
     * 生成状态的唯一键
     *
     * @param remainingOrders 剩余订单
     * @param usedStocks 已使用的原料
     * @returns 状态的唯一键
     */
    private generateStateKey(remainingOrders: number[], usedStocks: StockUsage[]): string {
        // 对剩余订单进行排序，确保状态唯一性
        const sortedOrders = [...remainingOrders].sort((a, b) => b - a);

        // 生成已使用原料的哈希表示
        const stocksHash = usedStocks.map(stock => {
            const sortedCuts = [...stock.cuts].sort((a, b) => b - a);
            return `${stock.stockLength}:[${sortedCuts.join(',')}]`;
        }).join('|');

        return `${sortedOrders.join(',')}_${stocksHash}`;
    }

    /**
     * 判断当前解是否比最优解更好
     *
     * @param currentStocks 当前使用的原料
     * @param remainingOrders 剩余订单
     * @returns 如果当前解比最优解更好，返回true
     */
    private isBetterSolution(currentStocks: StockUsage[], remainingOrders: number[]): boolean {
        // 如果还有剩余订单，则不是有效解
        if (remainingOrders.length > 0) {
            return false;
        }

        const totalStocksUsed = currentStocks.length;
        const totalWaste = currentStocks.reduce((sum, stock) => sum + stock.waste, 0);

        // 首先比较使用的原料数量
        if (totalStocksUsed < this.bestSolution.totalStocksUsed) {
            return true;
        }

        // 如果原料数量相同，比较废料
        if (totalStocksUsed === this.bestSolution.totalStocksUsed && totalWaste < this.bestSolution.totalWaste) {
            return true;
        }

        return false;
    }

    /**
     * 更新最优解
     *
     * @param currentStocks 当前使用的原料
     */
    private updateBestSolution(currentStocks: StockUsage[]): void {
        const totalStocksUsed = currentStocks.length;
        const totalWaste = currentStocks.reduce((sum, stock) => sum + stock.waste, 0);

        this.bestSolution = {
            usedStocks: JSON.parse(JSON.stringify(currentStocks)), // 深拷贝
            totalWaste,
            totalStocksUsed
        };
    }

    /**
     * 检查是否达到终止条件
     *
     * @returns 如果达到终止条件，返回true
     */
    private shouldTerminate(): boolean {
        // 检查时间限制
        const currentTime = Date.now();
        if (currentTime - this.startTime > this.timeLimit) {
            console.log(`[INFO] 达到时间限制 ${this.timeLimit}ms，停止搜索`);
            return true;
        }

        // 检查迭代次数限制
        this.iterationCount++;
        if (this.iterationCount > this.maxIterations) {
            console.log(`[INFO] 达到最大迭代次数 ${this.maxIterations}，停止搜索`);
            return true;
        }

        return false;
    }

    /**
     * 剪枝条件检查
     *
     * @param currentStocks 当前使用的原料
     * @param remainingOrders 剩余订单
     * @returns 如果满足剪枝条件，返回true
     */
    private shouldPrune(currentStocks: StockUsage[], remainingOrders: number[]): boolean {
        // 如果没有剩余订单，无需剪枝
        if (remainingOrders.length === 0) {
            return false;
        }

        // 检查已访问状态
        const stateKey = this.generateStateKey(remainingOrders, currentStocks);
        if (this.visited.has(stateKey)) {
            return true;
        }
        this.visited.add(stateKey);

        // 当前已使用的原料数量
        const usedStocksCount = currentStocks.length;

        // 如果当前使用的原料数量已经超过最优解，剪枝
        if (usedStocksCount >= this.bestSolution.totalStocksUsed) {
            return true;
        }

        // 计算下界：至少还需要多少原料
        const totalRemainingLength = remainingOrders.reduce((sum, len) => sum + len, 0);
        const remainingCuts = remainingOrders.length - 1; // 剩余切割次数
        const minCutWaste = remainingCuts > 0 ? remainingCuts * this.cutWidth : 0;
        const minRemainingStocks = Math.ceil((totalRemainingLength + minCutWaste) / this.stockLengths[0]);

        // 如果当前使用的原料加上至少需要的原料数量已经超过最优解，剪枝
        if (usedStocksCount + minRemainingStocks >= this.bestSolution.totalStocksUsed) {
            return true;
        }

        return false;
    }

    /**
     * 尝试将订单项放入现有原料
     *
     * @param orderItem 订单项长度
     * @param currentStocks 当前使用的原料
     * @returns 如果成功放入，返回放入的原料索引，否则返回-1
     */
    private tryPlaceInExistingStock(orderItem: number, currentStocks: StockUsage[]): number {
        let bestFitIndex = -1;
        let minRemainingSpace = Infinity;

        // 尝试Best Fit策略
        for (let i = 0; i < currentStocks.length; i++) {
            const stock = currentStocks[i];
            const required = stock.cuts.length > 0 ? orderItem + this.cutWidth : orderItem;

            if (required <= stock.waste) {
                const remainingAfterCut = stock.waste - required;
                if (remainingAfterCut < minRemainingSpace) {
                    minRemainingSpace = remainingAfterCut;
                    bestFitIndex = i;
                }
            }
        }

        // 如果找到合适的原料，进行切割
        if (bestFitIndex !== -1) {
            const required = currentStocks[bestFitIndex].cuts.length > 0 ?
                orderItem + this.cutWidth : orderItem;

            currentStocks[bestFitIndex].cuts.push(orderItem);
            currentStocks[bestFitIndex].waste -= required;
        }

        return bestFitIndex;
    }

    /**
     * 深度优先搜索函数
     *
     * @param remainingOrders 剩余订单
     * @param currentStocks 当前使用的原料
     */
    private dfs(remainingOrders: number[], currentStocks: StockUsage[]): void {
        // 检查终止条件
        if (this.shouldTerminate()) {
            return;
        }

        // 如果所有订单都已处理，检查是否为更好的解
        if (remainingOrders.length === 0) {
            if (this.isBetterSolution(currentStocks, remainingOrders)) {
                this.updateBestSolution(currentStocks);
            }
            return;
        }

        // 检查剪枝条件
        if (this.shouldPrune(currentStocks, remainingOrders)) {
            return;
        }

        // 获取当前处理的订单项（从最大的开始）
        const orderItem = remainingOrders[0];
        const newRemainingOrders = remainingOrders.slice(1);

        // 策略1：尝试放入现有的原料中
        const stocksCopy1 = JSON.parse(JSON.stringify(currentStocks));
        const placedIndex = this.tryPlaceInExistingStock(orderItem, stocksCopy1);

        if (placedIndex !== -1) {
            // 成功放入现有原料，继续搜索
            this.dfs(newRemainingOrders, stocksCopy1);
        }

        // 策略2：使用新的原料
        // 遍历所有可用的原料长度
        for (const stockLength of this.stockLengths) {
            // 如果订单项超过原料长度，跳过
            if (orderItem > stockLength) {
                continue;
            }

            // 创建新的原料
            const stocksCopy2 = JSON.parse(JSON.stringify(currentStocks));
            const newStock: StockUsage = {
                stockLength,
                cuts: [orderItem],
                waste: stockLength - orderItem
            };

            stocksCopy2.push(newStock);

            // 继续搜索
            this.dfs(newRemainingOrders, stocksCopy2);
        }
    }

    /**
     * 使用First Fit Decreasing算法获取初始解
     *
     * @returns 初始解
     */
    private getInitialSolution(): Solution {
        const remainingOrders = [...this.orderLengths];
        const usedStocks: StockUsage[] = [];
        const stockLengthsCopy = [...this.stockLengths];

        while (remainingOrders.length > 0) {
            if (stockLengthsCopy.length === 0) {
                throw new Error("原料不足以满足所有订单");
            }

            const currentStock = stockLengthsCopy.shift()!;
            const currentUsage: number[] = [];
            let remainingLength = currentStock;

            // 使用First Fit策略
            let i = 0;
            while (i < remainingOrders.length) {
                const orderLength = remainingOrders[i];
                const required = currentUsage.length > 0 ? orderLength + this.cutWidth : orderLength;

                if (required <= remainingLength) {
                    currentUsage.push(orderLength);
                    remainingLength -= required;
                    remainingOrders.splice(i, 1);
                } else {
                    i++;
                }
            }

            usedStocks.push({
                stockLength: currentStock,
                cuts: currentUsage,
                waste: remainingLength
            });
        }

        const totalWaste = usedStocks.reduce((sum, stock) => sum + stock.waste, 0);

        return {
            usedStocks,
            totalWaste,
            totalStocksUsed: usedStocks.length
        };
    }

    /**
     * 解决一维下料问题
     *
     * @returns 最优解
     */
    solve(): Solution {
        // 获取初始解
        try {
            const initialSolution = this.getInitialSolution();
            this.bestSolution = initialSolution;

            console.log(`[INFO] 初始解: 使用 ${initialSolution.totalStocksUsed} 根原料，总废料 ${initialSolution.totalWaste}`);
        } catch (error) {
            console.error(`[ERROR] 获取初始解失败: ${error.message}`);
            throw error;
        }

        // 开始DFS搜索
        this.startTime = Date.now();
        this.dfs(this.orderLengths, []);
        const endTime = Date.now();

        console.log(`[INFO] 搜索完成，耗时 ${endTime - this.startTime}ms，迭代次数 ${this.iterationCount}`);
        console.log(`[INFO] 最优解: 使用 ${this.bestSolution.totalStocksUsed} 根原料，总废料 ${this.bestSolution.totalWaste}`);

        return this.bestSolution;
    }

    /**
     * 验证解决方案的正确性
     *
     * @param solution 解决方案
     * @returns 验证结果
     */
    verifySolution(solution: Solution): {
        isValid: boolean;
        totalOrderLength: number;
        totalCutWaste: number;
        totalStockLength: number;
        calculatedTotal: number;
        difference: number;
    } {
        const usedStocks = solution.usedStocks;

        // 计算订单总长度
        const totalOrderLength = usedStocks.reduce((sum, stock) => {
            return sum + stock.cuts.reduce((s, cut) => s + cut, 0);
        }, 0);

        // 计算切割损耗
        const totalCutWaste = usedStocks.reduce((sum, stock) => {
            return sum + Math.max(0, stock.cuts.length - 1) * this.cutWidth;
        }, 0);

        // 计算原料总长度
        const totalStockLength = usedStocks.reduce((sum, stock) => sum + stock.stockLength, 0);

        // 计算废料总量
        const totalWaste = usedStocks.reduce((sum, stock) => sum + stock.waste, 0);

        // 计算得到的总长度应该是：订单总长度 + 切割损耗 + 废料总量
        const calculatedTotal = totalOrderLength + totalCutWaste + totalWaste;

        // 计算差异（应该为0或非常接近0）
        const difference = totalStockLength - calculatedTotal;

        // 检查解决方案是否有效
        const isValid = Math.abs(difference) < 0.001 && totalOrderLength === this.orderLengths.reduce((sum, len) => sum + len, 0);

        return {
            isValid,
            totalOrderLength,
            totalCutWaste,
            totalStockLength,
            calculatedTotal,
            difference
        };
    }
}