export async function translateOne(text: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const data = await res.json();
  return (data[0] as [string][]).map((chunk) => chunk[0]).join("");
}

export async function translateBatch(texts: string[]): Promise<string[]> {
  return Promise.all(texts.map(translateOne));
}
