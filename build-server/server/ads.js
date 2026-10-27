/**
 * ads.txt para AdSense: declara qué cuenta puede vender anuncios en el dominio.
 * Se genera a partir de VITE_ADSENSE_CLIENT para no duplicar el identificador.
 */
export function adsTxt(client) {
    const pub = client?.match(/^ca-(pub-\d+)$/)?.[1];
    const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# Sin anuncios configurados\n';
    return new Response(body, {
        status: pub ? 200 : 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    });
}
