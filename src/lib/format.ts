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

export function shortenAddress(value: string, visible = 4) {
  if (value.length <= visible * 2) {
    return value;
  }

  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
