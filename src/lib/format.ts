export function formatUsd(value: number | null) {
  if (value === null) {
    return "待补价";
  }

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatGradeNumber(value: string | null) {
  if (!value) {
    return "--";
  }

  return value.trim().replace(/\.0+$/, "");
}

export function shortenAddress(value: string, visible = 4) {
  if (value.length <= visible * 2) {
    return value;
  }

  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
