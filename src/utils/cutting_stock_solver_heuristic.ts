import { StockCutPlan, CutSummary, CutResult } from "./cutting_stock_types";

export function solveCuttingProblem(
    stockLengths: number[],
    stockCounts: number[],
    orderLengths: number[],
    orderCounts: number[],
    cutWidth: number
): CutResult {
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

    const solver = new StockCuttingSolver(stockPool, orderPool, cutWidth);

    try {
        const [solution, totalWaste, stockUsed] = solver.solve();

        const groupedMap: Map<string, StockCutPlan> = new Map();
        for (const stock of solution) {
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
                totalStockUsed: stockUsed,
                totalCutLoss: verification.totalCutWaste,
                totalWaste: totalWaste,
                isOrderFulfilled: true
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



interface StockUsage {
    stockLength: number;  // 原料长度
    cuts: number[];       // 切割尺寸列表
    waste: number;        // 剩余废料
}

class StockCuttingSolver {
    private stockLengths: number[];
    private orderLengths: number[];
    private cutWidth: number;

    /**
     * 初始化下料问题求解器
     *
     * @param stockLengths 原料棒材的长度列表
     * @param orderLengths 需要切割的订单长度列表
     * @param cutWidth 每次切割的损耗宽度，默认为0
     */
    constructor(stockLengths: number[], orderLengths: number[], cutWidth: number = 0) {
        this.stockLengths = [...stockLengths].sort((a, b) => b - a);  // 将原料按从长到短排序
        this.orderLengths = [...orderLengths].sort((a, b) => b - a);  // 将订单按从长到短排序
        this.cutWidth = cutWidth;
    }

    /**
     * 使用First Fit Decreasing算法解决下料问题
     *
     * @returns 使用的原料及其切割情况的列表和总废料长度
     */
    firstFitDecreasing(): [StockUsage[], number] {
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

            let i = 0;
            while (i < remainingOrders.length) {
                const orderLength = remainingOrders[i];
                // 计算所需长度，第一个切割不需要考虑切割宽度
                const required = orderLength + (currentUsage.length > 0 ? this.cutWidth : 0);

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
        return [usedStocks, totalWaste];
    }

    /**
     * 使用Best Fit Decreasing (BFD)算法解决下料问题
     *
     * @returns 使用的原料及其切割情况的列表和总废料长度
     */
    bestFitDecreasing(): [StockUsage[], number] {
        const remainingOrders = [...this.orderLengths];
        const usedStocks: StockUsage[] = [];
        const remainingLengths: number[] = [];
        const stockLengthsCopy = [...this.stockLengths];

        while (remainingOrders.length > 0) {
            const orderLength = remainingOrders.shift()!;

            // 尝试放入现有的原料棒中，找到最佳匹配
            let bestBin = -1;
            let minRemaining = Infinity;

            for (let i = 0; i < usedStocks.length; i++) {
                // 计算所需长度，如果当前原料棒已有切割，需考虑切割宽度
                const required = orderLength + (usedStocks[i].cuts.length > 0 ? this.cutWidth : 0);

                if (required <= remainingLengths[i]) {
                    const remainingAfterCut = remainingLengths[i] - required;
                    if (remainingAfterCut < minRemaining) {
                        minRemaining = remainingAfterCut;
                        bestBin = i;
                    }
                }
            }

            // 如果找到合适的位置
            if (bestBin !== -1) {
                usedStocks[bestBin].cuts.push(orderLength);
                const required = orderLength + (usedStocks[bestBin].cuts.length > 1 ? this.cutWidth : 0);
                remainingLengths[bestBin] -= required;
                usedStocks[bestBin].waste = remainingLengths[bestBin];
            } else {
                // 需要使用新的原料棒
                if (stockLengthsCopy.length === 0) {
                    throw new Error("原料不足以满足所有订单");
                }

                const newStock = stockLengthsCopy.shift()!;
                const remainingAfterCut = newStock - orderLength;
                usedStocks.push({
                    stockLength: newStock,
                    cuts: [orderLength],
                    waste: remainingAfterCut
                });
                remainingLengths.push(remainingAfterCut);
            }
        }

        // 计算总废料
        const totalWaste = usedStocks.reduce((sum, stock) => sum + stock.waste, 0);

        return [usedStocks, totalWaste];
    }

    /**
     * 使用混合启发式+贪心+优化后处理算法解决下料问题
     *
     * @returns 使用的原料及其切割情况的列表和总废料长度
     */
    hybridOptimized(): [StockUsage[], number] {
        // 第一阶段：使用BFD得到初始解
        const [initialSolution, initialWaste] = this.bestFitDecreasing();

        // 第二阶段：启发式优化 - 交换不同原料棒之间的切割
        const optimizedSolution = [...initialSolution];
        let improved = true;
        let iterations = 0;
        const MAX_ITERATIONS = 100; // 避免无限循环

        while (improved && iterations < MAX_ITERATIONS) {
            improved = false;
            iterations++;

            // 尝试交换任意两个原料棒之间的任意两个切割项
            for (let i = 0; i < optimizedSolution.length; i++) {
                for (let j = i + 1; j < optimizedSolution.length; j++) {
                    for (let ci = 0; ci < optimizedSolution[i].cuts.length; ci++) {
                        for (let cj = 0; cj < optimizedSolution[j].cuts.length; cj++) {
                            // 计算交换前的废料
                            const wasteBefore = optimizedSolution[i].waste + optimizedSolution[j].waste;

                            // 尝试交换
                            const cutI = optimizedSolution[i].cuts[ci];
                            const cutJ = optimizedSolution[j].cuts[cj];

                            // 计算交换后的情况
                            // 首先计算移除后的剩余长度
                            let remainingLengthI = optimizedSolution[i].waste;
                            let remainingLengthJ = optimizedSolution[j].waste;

                            // 考虑移除切割项后可能节省的切割宽度
                            if (optimizedSolution[i].cuts.length > 1) {
                                remainingLengthI += cutI + this.cutWidth;
                            } else {
                                remainingLengthI += cutI;
                            }

                            if (optimizedSolution[j].cuts.length > 1) {
                                remainingLengthJ += cutJ + this.cutWidth;
                            } else {
                                remainingLengthJ += cutJ;
                            }

                            // 计算添加新切割项后的废料
                            // 如果原料棒中剩余其他切割项，需要考虑切割宽度
                            const needCutWidthI = optimizedSolution[i].cuts.length > 1 || (optimizedSolution[i].cuts.length === 1 && ci !== 0);
                            const needCutWidthJ = optimizedSolution[j].cuts.length > 1 || (optimizedSolution[j].cuts.length === 1 && cj !== 0);

                            const newWasteI = remainingLengthI - cutJ - (needCutWidthI ? this.cutWidth : 0);
                            const newWasteJ = remainingLengthJ - cutI - (needCutWidthJ ? this.cutWidth : 0);

                            // 如果交换能减少总废料并且两边都能放下交换的切割项
                            if (newWasteI >= 0 && newWasteJ >= 0 && (newWasteI + newWasteJ < wasteBefore)) {
                                // 执行交换
                                optimizedSolution[i].cuts[ci] = cutJ;
                                optimizedSolution[j].cuts[cj] = cutI;
                                optimizedSolution[i].waste = newWasteI;
                                optimizedSolution[j].waste = newWasteJ;

                                improved = true;
                            }
                        }
                    }
                }
            }
        }

        // 第三阶段：后处理 - 尝试合并低利用率的原料棒
        const finalSolution: StockUsage[] = [];
        // 按照利用率从低到高排序
        const usedStocks = [...optimizedSolution].sort((a, b) =>
            (a.stockLength - a.waste) / a.stockLength - (b.stockLength - b.waste) / b.stockLength
        );

        // 尝试将利用率低的原料棒中的切割项重新分配
        for (const stock of usedStocks) {
            if (stock.cuts.length === 0) continue;

            // 按大小排序当前原料棒的切割项
            const cutItems = [...stock.cuts].sort((a, b) => b - a);
            let allReassigned = true;

            // 为当前原料棒的每个切割项尝试找到新的位置
            for (const cutItem of cutItems) {
                let reassigned = false;

                // 尝试将切割项放入已有的原料棒
                for (let i = 0; i < finalSolution.length && !reassigned; i++) {
                    // 计算所需长度，如果当前原料棒已有切割，需考虑切割宽度
                    const required = cutItem + (finalSolution[i].cuts.length > 0 ? this.cutWidth : 0);

                    if (required <= finalSolution[i].waste) {
                        // 可以放入这个原料棒
                        finalSolution[i].cuts.push(cutItem);
                        finalSolution[i].waste -= required;
                        reassigned = true;
                    }
                }

                // 如果有任何一个切割项不能重新分配，则将整个原料棒添加到最终解中
                if (!reassigned) {
                    allReassigned = false;
                    break;
                }
            }

            // 如果不是所有切割项都能重新分配，则将原始原料棒添加到最终解中
            if (!allReassigned) {
                finalSolution.push({...stock});
            }
        }

        // 计算总废料
        const totalWaste = finalSolution.reduce((sum, stock) => sum + stock.waste, 0);

        return [finalSolution, totalWaste];
    }

    /**
     * 解决下料问题，返回最优解
     *
     * @returns 最佳切割方案、总废料长度和使用的原料数量
     */
    solve(): [StockUsage[], number, number] {
        // 复制原料列表，以便在不同算法中使用
        const originalStocks = [...this.stockLengths];

        // 使用First Fit Decreasing算法
        this.stockLengths = [...originalStocks];
        const [ffdSolution, ffdWaste] = this.firstFitDecreasing();

        // 使用Best Fit Decreasing算法
        this.stockLengths = [...originalStocks];
        const [bfdSolution, bfdWaste] = this.bestFitDecreasing();

        // 使用混合优化算法
        this.stockLengths = [...originalStocks];
        const [hybridSolution, hybridWaste] = this.hybridOptimized();

        // 选择总废料最少的方案
        let bestSolution: StockUsage[];
        let totalWaste: number;

        if (hybridWaste <= ffdWaste && hybridWaste <= bfdWaste) {
            bestSolution = hybridSolution;
            totalWaste = hybridWaste;
        } else if (ffdWaste <= bfdWaste) {
            bestSolution = ffdSolution;
            totalWaste = ffdWaste;
        } else {
            bestSolution = bfdSolution;
            totalWaste = bfdWaste;
        }

        // 确保原料列表恢复
        this.stockLengths = originalStocks;

        return [bestSolution, totalWaste, bestSolution.length];
    }

    /**
     * 验证解决方案的正确性
     *
     * @param solution 切割方案
     * @returns 验证结果信息
     */
    verifySolution(solution: StockUsage[]): {
        totalOrderLength: number;
        totalCutWaste: number;
        totalStockLength: number;
        calculatedTotal: number;
        difference: number;
    } {
        // 计算订单总长度
        const totalOrderLength = solution.reduce((sum, stock) => {
            return sum + stock.cuts.reduce((s, cut) => s + cut, 0);
        }, 0);

        // 计算切割损耗
        const totalCutWaste = solution.reduce((sum, stock) => {
            // 每个原料棒的切割次数为切割项数量减1，因为最后一个切割项不需要额外的切割
            return sum + Math.max(0, stock.cuts.length - 1) * this.cutWidth;
        }, 0);

        // 计算原料总长度
        const totalStockLength = solution.reduce((sum, stock) => sum + stock.stockLength, 0);

        // 计算废料总量
        const totalWaste = solution.reduce((sum, stock) => sum + stock.waste, 0);

        // 计算得到的总长度应该是：订单总长度 + 切割损耗 + 废料总量
        const calculatedTotal = totalOrderLength + totalCutWaste + totalWaste;

        // 计算差异（应该为0或非常接近0）
        const difference = totalStockLength - calculatedTotal;

        return {
            totalOrderLength,
            totalCutWaste,
            totalStockLength,
            calculatedTotal,
            difference
        };
    }
}
