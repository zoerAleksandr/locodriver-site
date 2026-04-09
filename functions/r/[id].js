/**
 * Cloudflare Pages Function — обрабатывает запросы /r/{id}.
 *
 * Для всех URL вида https://locodriver.ru/r/{что_угодно} эта функция
 * возвращает статический файл /r/index.html через env.ASSETS (который
 * обходит Functions и идёт напрямую к static assets, без рекурсии).
 *
 * URL в адресной строке сохраняется (/r/{id}), а JavaScript внутри
 * index.html извлекает id из window.location.pathname и пытается открыть
 * deep link locodriver://share/{id}.
 *
 * Почему не _redirects:
 * Cloudflare Pages без платного плана не применяет dynamic splat rewrites
 * из _redirects файла — правила вида `/r/*  /r/index.html  200` молча
 * игнорируются, и Pages показывает либо 404, либо корневой index.html.
 * Pages Functions работают на free tier без ограничений.
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    url.pathname = "/r/index.html";
    return context.env.ASSETS.fetch(new Request(url, context.request));
}
