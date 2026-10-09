export function pesos(centavos) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(centavos / 100)
}

export function toCentavos(value) {
  const text = String(value).trim()
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) throw new Error('Enter an amount with at most two decimal places.')
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
