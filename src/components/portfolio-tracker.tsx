"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";

import { formatUsd, shortenAddress } from "@/lib/format";
import type { PortfolioItem, PortfolioResponse } from "@/lib/types";

import styles from "./portfolio-tracker.module.css";

type QueryState = {
  data: PortfolioResponse | null;
  error: string | null;
};

type ThemeMode = "light" | "dark";

const initialState: QueryState = {
  data: null,
  error: null,
};

const THEME_STORAGE_KEY = "collector-crypt-theme";

const getFieldValue = (value: string | null) => value ?? "--";

const getRatingDisplay = (item: PortfolioItem) => {
  const company = item.gradingCompany?.trim().toUpperCase();
  const label = item.gradeLabel?.trim().toUpperCase() ?? "";
  const score = item.gradeScore?.trim();

  if (!company) {
    return "--";
  }

  if (company === "CGC" && /PRISTINE|GOLD|金/.test(label)) {
    return `CGC金${score ?? ""}`;
  }

  if (company === "BGS" && /BLACK|黑/.test(label)) {
    return `BGS黑${score ?? ""}`;
  }

  if (score) {
    return `${company}${score}`;
  }

  if (label) {
    return `${company}${label}`;
  }

  return company;
};

const applyTheme = (theme: ThemeMode) => {
  document.documentElement.dataset.theme = theme;
};

export function PortfolioTracker() {
  const [address, setAddress] = useState("");
  const [queryState, setQueryState] = useState<QueryState>(initialState);
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
                当前地址下没有识别到 Collector Crypt NFT，或该地址暂时未持有标准 NFT / pNFT。
              </div>
            ) : null}

            {data && items.length > 0 ? (
              <div className={styles.grid}>
                {items.map((item) => (
                  <article className={styles.card} key={item.mint}>
                    <div className={styles.thumb}>
                      {item.image ? (
                        <Image
                          alt={item.name}
                          fill
                          sizes="(max-width: 720px) 72vw, 188px"
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
                          <span className={styles.collection}>{item.collectionLabel}</span>
                        </div>
                        <span
                          className={`${styles.badge} ${item.priced ? "" : styles.badgeMuted}`}
                        >
                          {item.priced ? "官方已定价" : "待补价"}
                        </span>
                      </div>

                      <dl className={styles.details}>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailLabel}>评级</dt>
                          <dd className={styles.detailValue}>{getRatingDisplay(item)}</dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailLabel}>证书编号</dt>
                          <dd className={`${styles.detailValue} ${styles.detailCode}`}>
                            {getFieldValue(item.certificateNumber)}
                          </dd>
                        </div>
                      </dl>

                      <div
                        className={`${styles.pricePanel} ${item.priced ? "" : styles.pricePanelPending}`}
                      >
                        <div className={styles.priceLabel}>官方价格</div>
                        <div
                          className={`${styles.price} ${item.priced ? "" : styles.pricePending}`}
                        >
                          {formatUsd(item.officialUsdValue)}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
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
        深/浅色
      </button>
    </>
  );
}
