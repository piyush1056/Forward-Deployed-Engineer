export function calculate({ operation, a, b }) {
  console.log(' Calculator tool execution invoked');
  if (operation === 'add') return a + b;
  if (operation === 'subtract') return a - b;
  if (operation === 'multiply') return a * b;
  if (operation === 'divide') {
    if (b === 0) throw new Error('Cannot divide by zero');
    return a / b;
  }
  if (operation === 'mod') {
    if (b === 0) throw new Error('Cannot calculate mod by zero');
    return a % b;
  }
  if (operation === 'power') return a ** b;
  throw new Error(`Unsupported arithmetic operation: ${operation}`);
}

export async function currentWeather({ city }) {
  console.log(` Fetching weather metadata for: ${city}`);
  const url = new URL('https://api.weatherapi.com/v1/current.json');
  url.searchParams.set('key', process.env.WEATHER_API_KEY || '');
  url.searchParams.set('q', city);
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}

export async function getExchangeRate({ from, to }) {
  console.log(` Processing conversion rates from ${from} to ${to}`);
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`
  );
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}
