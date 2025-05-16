export interface StockCutPlan {
    stockLength: number;
    cutLengths: number[];   // 切割长度种类
    cutCounts: number[];    // 对应的每种切割长度的数量
    count: number;
    totalWaste: number;
    avgWaste: number;
}

export interface CutSummary {
    totalStockUsed: number;
    totalCutLoss: number;
    totalWaste: number;
    isOrderFulfilled: boolean;
}

export interface CutResult {
    plans: StockCutPlan[];
    summary: CutSummary;
}