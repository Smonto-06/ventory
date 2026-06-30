export function fmt(n: number): string {
  const rounded = Math.round(n)
  const abs = Math.abs(rounded)
  const withDots = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$ ${rounded < 0 ? '-' : ''}${withDots}`
}
