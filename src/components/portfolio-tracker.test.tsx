/* eslint-disable @next/next/no-img-element */
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PortfolioTracker } from "@/components/portfolio-tracker";

const mockFetch = vi.fn();

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill: _fill,
    unoptimized: _unoptimized,
    sizes: _sizes,
    ...props
  }: ComponentProps<"img"> & {
    fill?: boolean;
    unoptimized?: boolean;
    sizes?: string;
  }) => <img {...props} alt={alt ?? ""} />,
}));

describe("PortfolioTracker", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    window.localStorage.clear();
    document.documentElement.dataset.theme = "light";
  });

  it("渲染默认空态", () => {
    render(<PortfolioTracker />);

    expect(screen.getByText("Collector Crypt NFT 持仓追踪")).toBeInTheDocument();
    expect(
      screen.getByText("输入钱包地址后即可开始统计，结果会按已识别美元价值从高到低排序。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "切换深色浅色主题" }),
    ).toHaveTextContent("深/浅色");
  });

  it("可以切换主题按钮文案", () => {
    render(<PortfolioTracker />);

    const toggle = screen.getByRole("button", { name: "切换深色浅色主题" });
    fireEvent.click(toggle);

    expect(toggle).toHaveTextContent("深/浅色");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("提交后显示查询结果", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        address: "DemoWallet111111111111111111111111111111111111",
        items: [
          {
            mint: "Mint11111111111111111111111111111111111111111",
            name: "Collector Crypt Pikachu",
            image: "https://example.com/pikachu-front.png",
            collectionLabel: "Collector Crypt: Pokemon",
            gradingCompany: "PSA",
            gradeLabel: "GEM MINT 10",
            gradeScore: "10",
            certificateNumber: "12345678",
            officialUsdValue: 42.5,
            priced: true,
          },
        ],
        summary: {
          totalOfficialUsd: 42.5,
          pricedCount: 1,
          unpricedCount: 0,
          totalCollectorCryptCount: 1,
        },
        sourceStatus: {
          chain: "ok",
          pricing: "ok",
          rpcUrl: "https://api.mainnet-beta.solana.com",
          priceCodes: ["pokemon_50", "pokemon_250"],
          pricingSource: "collector-crypt-public",
          pricingLabel: "Collector Crypt 公开站点接口",
        },
      }),
    });

    render(<PortfolioTracker />);

    fireEvent.change(screen.getByLabelText("Solana 地址"), {
      target: { value: "DemoWallet111111111111111111111111111111111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByText("Collector Crypt Pikachu")).toBeInTheDocument();
    });

    expect(screen.getAllByText("US$42.50")).toHaveLength(2);
    expect(screen.getByText("官方已定价")).toBeInTheDocument();
    expect(screen.getByText("PSA10")).toBeInTheDocument();
    expect(screen.getByText("12345678")).toBeInTheDocument();
    expect(screen.queryByText(/^Mint$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/评级说明/)).not.toBeInTheDocument();
    expect(screen.getByAltText("Collector Crypt Pikachu")).toHaveAttribute(
      "src",
      "https://example.com/pikachu-front.png",
    );
  });

  it("接口报错时显示错误文案", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        message: "Collector Crypt 公开站点价格接口请求失败，请稍后重试。",
      }),
    });

    render(<PortfolioTracker />);

    fireEvent.change(screen.getByLabelText("Solana 地址"), {
      target: { value: "DemoWallet111111111111111111111111111111111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(
        screen.getByText("Collector Crypt 公开站点价格接口请求失败，请稍后重试。"),
      ).toBeInTheDocument();
    });
  });
});
