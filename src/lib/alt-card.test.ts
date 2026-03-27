import {
  buildAltResearchCard,
  buildRecentTransactions,
} from "@/lib/alt-card";

describe("alt-card", () => {
  it("会按日期和价格整理最近成交记录", () => {
    const transactions = buildRecentTransactions(
      [
        { id: "market-1", date: "2026-03-24", price: "70.00" },
        { id: "market-2", date: "2026-03-26", price: "85.00" },
      ],
      [
        { id: "external-1", date: "2026-03-25", price: 72 },
        { id: "external-2", date: "2026-03-26", price: 80 },
      ],
    );

    expect(transactions.map((item) => item.id)).toEqual([
      "market-2",
      "external-2",
      "external-1",
      "market-1",
    ]);
    expect(transactions[0]?.source).toBe("market");
    expect(transactions[1]?.source).toBe("external");
  });

  it("会整理 Alt 返回的人口和当前评级人口", () => {
    const card = buildAltResearchCard(
      {
        certNumber: "12345678",
        gradingCompany: "PSA",
        gradeNumber: "10.0",
        asset: {
          id: "asset-1",
          name: "Test Card",
        },
      },
      {
        id: "asset-1",
        name: "Test Card",
        altValueInfo: {
          currentAltValue: 88.5,
        },
        cardPops: [
          { gradingCompany: "PSA", gradeNumber: "9.0", count: 10 },
          { gradingCompany: "PSA", gradeNumber: "10.0", count: 3 },
          { gradingCompany: "CGC", gradeNumber: "10.5", count: 1 },
        ],
        marketTransactions: [],
        externalTransactions: [],
      },
    );

    expect(card.gradeNumber).toBe("10");
    expect(card.currentGradePopulation).toBe(3);
    expect(card.populations[0]).toEqual({
      gradingCompany: "PSA",
      gradeNumber: "10",
      count: 3,
    });
  });
});
