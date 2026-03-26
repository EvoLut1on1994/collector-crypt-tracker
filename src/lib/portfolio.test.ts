import {
  normalizeInsuredValue,
  normalizePublicInsuredValue,
} from "@/lib/collector-crypt";
import { buildPortfolioSummary, sortPortfolioItems } from "@/lib/portfolio";
import type { PortfolioItem } from "@/lib/types";

describe("normalizeInsuredValue", () => {
  it("把 Collector Crypt 的微美元整数换算成美元", () => {
    expect(normalizeInsuredValue(42_500_000)).toBe(42.5);
    expect(normalizeInsuredValue("1")).toBe(0.000001);
  });

  it("遇到无效值时返回 null", () => {
    expect(normalizeInsuredValue(undefined)).toBeNull();
    expect(normalizeInsuredValue("abc")).toBeNull();
  });
});

describe("normalizePublicInsuredValue", () => {
  it("把公开站点接口的美元字符串转换成数字", () => {
    expect(normalizePublicInsuredValue("32")).toBe(32);
    expect(normalizePublicInsuredValue("43.75")).toBe(43.75);
  });

  it("遇到无效值时返回 null", () => {
    expect(normalizePublicInsuredValue(undefined)).toBeNull();
    expect(normalizePublicInsuredValue("abc")).toBeNull();
  });
});

describe("portfolio helpers", () => {
  const items: PortfolioItem[] = [
    {
      mint: "mint-b",
      name: "Beta",
      image: null,
      collectionLabel: "Collector Crypt",
      gradingCompany: null,
      gradeLabel: null,
      gradeScore: null,
      certificateNumber: null,
      officialUsdValue: null,
      priced: false,
    },
    {
      mint: "mint-a",
      name: "Alpha",
      image: null,
      collectionLabel: "Collector Crypt",
      gradingCompany: "PSA",
      gradeLabel: "GEM MINT 10",
      gradeScore: "10",
      certificateNumber: "111",
      officialUsdValue: 15.21,
      priced: true,
    },
    {
      mint: "mint-c",
      name: "Gamma",
      image: null,
      collectionLabel: "Collector Crypt",
      gradingCompany: "CGC",
      gradeLabel: "PRISTINE 10",
      gradeScore: "10",
      certificateNumber: "222",
      officialUsdValue: 88.6,
      priced: true,
    },
  ];

  it("按已定价优先且价格降序排序", () => {
    expect(sortPortfolioItems(items).map((item) => item.mint)).toEqual([
      "mint-c",
      "mint-a",
      "mint-b",
    ]);
  });

  it("汇总总价值与定价数量", () => {
    expect(buildPortfolioSummary(items)).toEqual({
      totalOfficialUsd: 103.81,
      pricedCount: 2,
      unpricedCount: 1,
      totalCollectorCryptCount: 3,
    });
  });
});
