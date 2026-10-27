// Carga un bloque de AdSense con los parámetros que manda DataClean (cliente, bloque y npa).
;(function () {
  var params = new URLSearchParams(location.search)
  var client = params.get('client') || ''
  var slot = params.get('slot') || ''
  if (!/^ca-pub-\d+$/.test(client) || !/^\d+$/.test(slot)) return

  var ins = document.createElement('ins')
  ins.className = 'adsbygoogle'
  ins.setAttribute('data-ad-client', client)
  ins.setAttribute('data-ad-slot', slot)
  ins.setAttribute('data-ad-format', 'horizontal')
  ins.setAttribute('data-full-width-responsive', 'false')
  document.body.appendChild(ins)

  var queue = (window.adsbygoogle = window.adsbygoogle || [])
  // Sin consentimiento para anuncios personalizados se piden anuncios no personalizados.
  if (params.get('npa') === '1') queue.requestNonPersonalizedAds = 1

  var script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client)
  document.head.appendChild(script)
  queue.push({})
})()
