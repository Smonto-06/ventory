// Servidor SMTP mínimo para pruebas: acepta el mensaje y lo escribe a disco.
const net = require('net'), fs = require('fs')
const SALIDA = process.argv[2] || '/tmp/correos.jsonl'
net.createServer((sock) => {
  let datos = false, buffer = []
  sock.write('220 smtp-falso listo\r\n')
  sock.on('data', (chunk) => {
    const texto = chunk.toString()
    if (datos) {
      buffer.push(texto)
      if (texto.includes('\r\n.\r\n')) {
        datos = false
        const cuerpo = buffer.join('')
        fs.appendFileSync(SALIDA, JSON.stringify({ ts: Date.now(), cuerpo }) + '\n')
        buffer = []
        sock.write('250 OK\r\n')
      }
      return
    }
    for (const linea of texto.split('\r\n').filter(Boolean)) {
      const cmd = linea.slice(0, 4).toUpperCase()
      if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-smtp-falso\r\n250 AUTH PLAIN LOGIN\r\n')
      else if (cmd === 'AUTH') sock.write('235 autenticado\r\n')
      else if (cmd === 'MAIL' || cmd === 'RCPT') sock.write('250 OK\r\n')
      else if (cmd === 'DATA') { datos = true; sock.write('354 adelante\r\n') }
      else if (cmd === 'QUIT') { sock.write('221 chao\r\n'); sock.end() }
      else sock.write('250 OK\r\n')
    }
  })
  sock.on('error', () => {})
}).listen(2525, '127.0.0.1', () => console.log('smtp-falso escuchando en 2525'))
