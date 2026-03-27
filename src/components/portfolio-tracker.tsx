"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";

import {
  formatCount,
  formatGradeNumber,
  formatUsd,
  shortenAddress,
} from "@/lib/format";
import type {
  AltPopulationEntry,
  AltResearchCard,
  AltResearchResponse,
  AltTransactionSource,
  PortfolioItem,
  PortfolioResponse,
} from "@/lib/types";

import styles from "./portfolio-tracker.module.css";

type QueryState = {
  data: PortfolioResponse | null;
  error: string | null;
};

type ThemeMode = "light" | "dark";

type AltPanelState = {
  isOpen: boolean;
  isLoading: boolean;
  result: AltResearchResponse | null;
  error: string | null;
};

const initialState: QueryState = {
  data: null,
  error: null,
};

const THEME_STORAGE_KEY = "collector-crypt-theme";
const COMPANY_ORDER = ["PSA", "BGS", "CGC"];

const getFieldValue = (value: string | null) => value ?? "--";

const getRatingDisplay = (item: PortfolioItem) => {
  const company = item.gradingCompany?.trim().toUpperCase();
  const label = item.gradeLabel?.trim().toUpperCase() ?? "";
  const score = formatGradeNumber(item.gradeScore);

  if (!company) {
    return "--";
  }

  if (company === "CGC" && /PRISTINE|GOLD|金/.test(label)) {
    return `CGC金${score === "--" ? "" : score}`;
  }

  if (company === "BGS" && /BLACK|BLACK LABEL|黑/.test(label)) {
    return `BGS黑${score === "--" ? "" : score}`;
  }

  if (score !== "--") {
    return `${company}${score}`;
  }

  if (label) {
    return `${company}${label}`;
  }

  return company;
};

const getAltSourceLabel = (source: AltTransactionSource) =>
  source === "market" ? "Alt 市场" : "外部成交";

const groupPopulations = (populations: AltPopulationEntry[]) => {
  const groups = new Map<string, AltPopulationEntry[]>();

  for (const population of populations) {
    if (population.count <= 0) {
      continue;
    }

    const company = population.gradingCompany.toUpperCase();
    const existing = groups.get(company) ?? [];
    existing.push(population);
    groups.set(company, existing);
  }

  return [...groups.entries()]
    .sort((left, right) => {
      const leftIndex = COMPANY_ORDER.indexOf(left[0]);
      const rightIndex = COMPANY_ORDER.indexOf(right[0]);
      const safeLeftIndex = leftIndex === -1 ? COMPANY_ORDER.length : leftIndex;
      const safeRightIndex = rightIndex === -1 ? COMPANY_ORDER.length : rightIndex;

      if (safeLeftIndex !== safeRightIndex) {
        return safeLeftIndex - safeRightIndex;
      }

      return left[0].localeCompare(right[0], "en-US");
    })
    .map(([company, entries]) => ({
      company,
      entries,
    }));
};

const applyTheme = (theme: ThemeMode) => {
  document.documentElement.dataset.theme = theme;
};

const getAltStateForItem = (
  altStates: Record<string, AltPanelState>,
  mint: string,
): AltPanelState =>
  altStates[mint] ?? {
    isOpen: false,
    isLoading: false,
    result: null,
    error: null,
  };

function AltResearchPanel({ card }: { card: AltResearchCard }) {
  const groups = groupPopulations(card.populations);

  return (
    <section className={styles.altPanel}>
      <div className={styles.altPanelHeader}>
        <div>
          <h4 className={styles.altPanelTitle}>Alt 研究数据</h4>
          <p className={styles.altPanelSubtle}>
            证书编号 {card.certificateNumber} · {card.assetName}
          </p>
        </div>
      </div>

      <div className={styles.altHighlights}>
        <article className={styles.altHighlight}>
          <span className={styles.altHighlightLabel}>当前评级人口</span>
          <strong className={styles.altHighlightValue}>
            {card.currentGradePopulation === null
              ? "--"
              : formatCount(card.currentGradePopulation)}
          </strong>
          <span className={styles.altHighlightMeta}>
            {card.gradingCompany} {card.gradeNumber}
          </span>
        </article>

        {card.currentAltValue !== null ? (
          <article className={styles.altHighlight}>
            <span className={styles.altHighlightLabel}>Alt 当前估值</span>
            <strong className={styles.altHighlightValue}>
              {formatUsd(card.currentAltValue)}
            </strong>
            <span className={styles.altHighlightMeta}>仅供参考</span>
          </article>
        ) : null}
      </div>

      <div className={styles.altSection}>
        <div className={styles.altSectionTitle}>评级人口分布</div>
        {groups.length > 0 ? (
          <div className={styles.altPopulationGroups}>
            {groups.map((group) => (
              <div className={styles.altPopulationGroup} key={group.company}>
                <div className={styles.altPopulationCompany}>{group.company}</div>
                <div className={styles.altPopulationGrid}>
                  {group.entries.map((entry) => {
                    const isCurrent =
                      entry.gradingCompany === card.gradingCompany &&
                      entry.gradeNumber === card.gradeNumber;

                    return (
                      <div
                        className={`${styles.altPopulationChip} ${
                          isCurrent ? styles.altPopulationChipCurrent : ""
                        }`}
                        key={`${entry.gradingCompany}-${entry.gradeNumber}`}
                      >
                        <span className={styles.altPopulationGrade}>
                          {entry.gradeNumber}
                        </span>
                        <span className={styles.altPopulationCount}>
                          {formatCount(entry.count)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.altEmpty}>Alt 暂无这张卡的人口分布数据。</div>
        )}
      </div>

      <div className={styles.altSection}>
        <div className={styles.altSectionTitle}>最近成交</div>
        {card.recentTransactions.length > 0 ? (
          <div className={styles.altTransactions}>
            {card.recentTransactions.map((transaction) => (
              <div className={styles.altTransactionRow} key={transaction.id}>
                <span className={styles.altTransactionSource}>
                  {getAltSourceLabel(transaction.source)}
                </span>
                <span className={styles.altTransactionDate}>
                  {transaction.date}
                </span>
                <strong className={styles.altTransactionPrice}>
                  {formatUsd(transaction.price)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.altEmpty}>Alt 暂无最近成交记录。</div>
        )}
      </div>
    </section>
  );
}

export function PortfolioTracker() {
  const [address, setAddress] = useState("");
  const [queryState, setQueryState] = useState<QueryState>(initialState);
  const [altStates, setAltStates] = useState<Record<string, AltPanelState>>({});
  const [lastQueriedAddress, setLastQueriedAddress] = useState("");
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : "light";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = address.trim();
    if (!trimmed) {
      setQueryState({
        data: null,
        error: "请先输入一个 Solana 地址。",
      });
      return;
    }

    startTransition(async () => {
      setQueryState({ data: null, error: null });
      setAltStates({});
      setLastQueriedAddress(trimmed);

      try {
        const response = await fetch(
          `/api/portfolio?address=${encodeURIComponent(trimmed)}`,
        );
        const payload = (await response.json()) as
          | PortfolioResponse
          | { message?: string };

        if (!response.ok) {
          setQueryState({
            data: null,
            error:
              "message" in payload && payload.message
                ? payload.message
                : "查询失败，请稍后再试。",
          });
          return;
        }

        setQueryState({
          data: payload as PortfolioResponse,
          error: null,
        });
      } catch {
        setQueryState({
          data: null,
          error: "网络请求失败，请检查本地服务是否正常运行。",
        });
      }
    });
  };

  const handleAltToggle = async (item: PortfolioItem) => {
    const current = getAltStateForItem(altStates, item.mint);

    if (current.isOpen) {
      setAltStates((previous) => ({
        ...previous,
        [item.mint]: {
          ...current,
          isOpen: false,
        },
      }));
      return;
    }

    if (current.result || current.error) {
      setAltStates((previous) => ({
        ...previous,
        [item.mint]: {
          ...current,
          isOpen: true,
        },
      }));
      return;
    }

    if (!item.certificateNumber) {
      setAltStates((previous) => ({
        ...previous,
        [item.mint]: {
          isOpen: true,
          isLoading: false,
          result: {
            found: false,
            certificateNumber: "",
            message: "这张卡暂时没有证书编号，无法查询 Alt 数据。",
          },
          error: null,
        },
      }));
      return;
    }

    setAltStates((previous) => ({
      ...previous,
      [item.mint]: {
        isOpen: true,
        isLoading: true,
        result: null,
        error: null,
      },
    }));

    try {
      const response = await fetch(
        `/api/alt-card?certificateNumber=${encodeURIComponent(
          item.certificateNumber,
        )}`,
      );
      const payload = (await response.json()) as
        | AltResearchResponse
        | { message?: string };

      if (!response.ok) {
        setAltStates((previous) => ({
          ...previous,
          [item.mint]: {
            isOpen: true,
            isLoading: false,
            result: null,
            error:
              "message" in payload && payload.message
                ? payload.message
                : "Alt 数据加载失败，请稍后重试。",
          },
        }));
        return;
      }

      setAltStates((previous) => ({
        ...previous,
        [item.mint]: {
          isOpen: true,
          isLoading: false,
          result: payload as AltResearchResponse,
          error: null,
        },
      }));
    } catch {
      setAltStates((previous) => ({
        ...previous,
        [item.mint]: {
          isOpen: true,
          isLoading: false,
          result: null,
          error: "Alt 数据加载失败，请稍后重试。",
        },
      }));
    }
  };

  const { data, error } = queryState;
  const hasResult = Boolean(data);
  const stats = data?.summary;
  const items = data?.items ?? [];

  return (
    <>
      <main className={styles.shell}>
        <div className={styles.frame}>
          <section className={styles.hero}>
            <span className={styles.eyebrow}>Collector Crypt Portfolio</span>
            <h1 className={styles.title}>Collector Crypt NFT 持仓追踪</h1>
            <p className={styles.lead}>
              输入 Solana 地址，自动识别该地址当前持有的 Collector Crypt NFT，
              并补齐 Collector Crypt 可获取到的美元估值，汇总显示总持仓价值。
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                aria-label="Solana 地址"
                className={styles.input}
                placeholder="请输入 Solana 链地址"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
              <button className={styles.button} disabled={isPending} type="submit">
                {isPending ? "分析中..." : "开始分析"}
              </button>
            </form>

            <p className={styles.helper}>
              有 API Key 时优先走官方价格目录；没有 API Key 时，会自动回退到
              Collector Crypt 公开站点接口。
            </p>
          </section>

          {error ? <div className={styles.error}>{error}</div> : null}

          <section className={styles.stats}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>总官方价值</span>
              <div className={styles.statValue}>
                {hasResult ? formatUsd(stats?.totalOfficialUsd ?? 0) : "--"}
              </div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>已定价数量</span>
              <div className={styles.statValue}>
                {hasResult ? stats?.pricedCount : "--"}
              </div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>未定价数量</span>
              <div className={styles.statValue}>
                {hasResult ? stats?.unpricedCount : "--"}
              </div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Collector Crypt NFT 总数</span>
              <div className={styles.statValue}>
                {hasResult ? stats?.totalCollectorCryptCount : "--"}
              </div>
            </article>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTop}>
              <div>
                <h2 className={styles.panelTitle}>持仓明细</h2>
                <p className={styles.helper}>
                  {hasResult
                    ? `地址 ${shortenAddress(data?.address ?? "", 6)} 的 Collector Crypt NFT 明细`
                    : "查询完成后，这里会列出识别出的 NFT 及对应美元价值。"}
                </p>
              </div>
              {data ? (
                <div className={styles.source}>
                  价格来源：{data.sourceStatus.pricingLabel}
                </div>
              ) : null}
            </div>

            {!hasResult && !error ? (
              <div className={styles.empty}>
                输入钱包地址后即可开始统计，结果会按已识别美元价值从高到低排序。
              </div>
            ) : null}

            {data && items.length === 0 ? (
              <div className={styles.empty}>
                当前地址下没有识别到 Collector Crypt NFT，或该地址暂时未持有标准
                NFT / pNFT。
              </div>
            ) : null}

            {data && items.length > 0 ? (
              <div className={styles.grid}>
                {items.map((item) => {
                  const altState = getAltStateForItem(altStates, item.mint);

                  return (
                    <article className={styles.card} key={item.mint}>
                      <div className={styles.thumb}>
                        {item.image ? (
                          <Image
                            alt={item.name}
                            fill
                            sizes="(max-width: 720px) 72vw, 212px"
                            src={item.image}
                            unoptimized
                          />
                        ) : (
                          <div className={styles.thumbFallback}>NFT</div>
                        )}
                      </div>

                      <div className={styles.meta}>
                        <div className={styles.metaTop}>
                          <div>
                            <h3 className={styles.name}>{item.name}</h3>
                            <span className={styles.collection}>
                              {item.collectionLabel}
                            </span>
                          </div>

                          <button
                            className={styles.altToggle}
                            onClick={() => {
                              void handleAltToggle(item);
                            }}
                            type="button"
                          >
                            {altState.isLoading
                              ? "Alt 加载中..."
                              : altState.isOpen
                                ? "收起 Alt 数据"
                                : "查看 Alt 数据"}
                          </button>
                        </div>

                        <dl className={styles.details}>
                          <div className={styles.detailRow}>
                            <dt className={styles.detailLabel}>评级</dt>
                            <dd className={styles.detailValue}>
                              {getRatingDisplay(item)}
                            </dd>
                          </div>
                          <div className={styles.detailRow}>
                            <dt className={styles.detailLabel}>证书编号</dt>
                            <dd className={`${styles.detailValue} ${styles.detailCode}`}>
                              {getFieldValue(item.certificateNumber)}
                            </dd>
                          </div>
                        </dl>

                        <div
                          className={`${styles.pricePanel} ${
                            item.priced ? "" : styles.pricePanelPending
                          }`}
                        >
                          <div className={styles.priceLabel}>官方价格</div>
                          <div
                            className={`${styles.price} ${
                              item.priced ? "" : styles.pricePending
                            }`}
                          >
                            {formatUsd(item.officialUsdValue)}
                          </div>
                        </div>
                      </div>

                      {altState.isOpen ? (
                        <div className={styles.altPanelWrap}>
                          {altState.isLoading ? (
                            <div className={styles.altLoading}>
                              正在从 Alt 获取评级人口和最近成交记录...
                            </div>
                          ) : null}

                          {!altState.isLoading && altState.error ? (
                            <div className={styles.altError}>{altState.error}</div>
                          ) : null}

                          {!altState.isLoading &&
                          !altState.error &&
                          altState.result?.found === false ? (
                            <div className={styles.altEmpty}>
                              {altState.result.message}
                            </div>
                          ) : null}

                          {!altState.isLoading &&
                          !altState.error &&
                          altState.result?.found === true ? (
                            <AltResearchPanel card={altState.result.card} />
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {lastQueriedAddress && isPending ? (
              <div className={styles.helper}>
                正在分析地址 {shortenAddress(lastQueriedAddress, 6)}，请稍候...
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <button
        aria-label="切换深色浅色主题"
        className={styles.themeToggle}
        onClick={toggleTheme}
        type="button"
      >
        深 / 浅色
      </button>
    </>
  );
}
