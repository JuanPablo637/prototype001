<template>
  <main class="page">
    <section class="card">
      <h1>Registro de comprobantes</h1>

      <p class="subtitle">
        Toma una foto de una boleta, factura o guía. Luego presiona Procesar para leer los datos.
      </p>

      <!-- TOMAR FOTO -->
      <label class="upload-box">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          @change="seleccionarImagen"
        />
        <span>📷 Tomar foto del comprobante</span>
      </label>



      <!-- EDITOR DE RECORTE -->
      <div v-if="mostrarEditorRecorte" class="crop-modal">
        <div class="crop-card">
          <h2>Recortar comprobante</h2>

          <p class="crop-help">
            Ajusta el cuadro para que solo quede la boleta, factura o guía. Evita mesa, fondo y sombras.
          </p>

          <ClientOnly>
            <Cropper
              ref="cropperRef"
              class="cropper"
              :src="imagenOriginalPreview"
              :stencil-props="{
                movable: true,
                resizable: true
              }"
              :resize-image="{
                wheel: true,
                touch: true
              }"
              image-restriction="stencil"
            />
          </ClientOnly>

          <div class="crop-buttons">
            <button class="btn cancel" @click="cancelarRecorte">
              Cancelar
            </button>

            <button class="btn primary" @click="confirmarRecorte">
              Usar recorte
            </button>
          </div>
        </div>
      </div>

      <!-- VISTA PREVIA -->
      <div v-if="imagenPreview" class="preview-container">
        <h2>Vista previa</h2>
        <img
          :src="imagenPreview"
          alt="Vista previa del comprobante"
          class="preview"
        />
      </div>

      <!-- BOTONES -->
      <div class="buttons">
        <button
          class="btn primary"
          :disabled="!imagenFile || procesando"
          @click="procesarImagen"
        >
          {{ procesando ? 'Procesando...' : 'Procesar' }}
        </button>

        <button
          class="btn success"
          :disabled="!datosProcesados"
          @click="subirDatos"
        >
          Subir
        </button>
      </div>

      <!-- PROGRESO OCR -->
      <div v-if="procesando" class="progress-box">
        <p>Procesando imagen con OCR...</p>
        <div class="progress">
          <div class="progress-bar" :style="{ width: progresoOCR + '%' }"></div>
        </div>
        <small>{{ progresoOCR }}%</small>
      </div>

      <!-- DATOS DETECTADOS -->
      <section class="form">
        <h2>Datos detectados</h2>

        <label>
          Tipo de documento
          <input v-model="form.tipoDocumento" placeholder="Factura / Boleta / Guía" />
        </label>

        <label>
          RUC
          <input v-model="form.ruc" placeholder="Ej: 20123456789" />
        </label>

        <label>
          Proveedor
          <input v-model="form.proveedor" placeholder="Nombre del proveedor" />
        </label>

        <label>
          Serie
          <input v-model="form.serie" placeholder="Ej: F001" />
        </label>

        <label>
          Número
          <input v-model="form.numero" placeholder="Ej: 00012345" />
        </label>

        <label>
          Fecha de emisión
          <input v-model="form.fecha" placeholder="dd/mm/yyyy" />
        </label>

        <label>
          Total
          <input v-model="form.total" placeholder="Ej: 150.00" />
        </label>

        <label>
          Moneda
          <input v-model="form.moneda" placeholder="PEN / USD" />
        </label>

      </section>

      <!-- TEXTO OCR -->
      <section v-if="textoOCR" class="ocr-box">
        <div class="ocr-header">
          <h2>Texto leído por OCR</h2>
          <button class="btn-small" @click="mostrarTextoOCR = !mostrarTextoOCR">
            {{ mostrarTextoOCR ? 'Ocultar' : 'Ver texto' }}
          </button>
        </div>

        <pre v-if="mostrarTextoOCR">{{ textoOCR }}</pre>
      </section>

      <!-- MENSAJE -->
      <p v-if="mensaje" class="message">
        {{ mensaje }}
      </p>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'

import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'


const cropperRef = ref(null)
const imagenOriginalPreview = ref('')
const mostrarEditorRecorte = ref(false)

const imagenFile = ref(null)
const imagenPreview = ref('')
const datosProcesados = ref(false)
const procesando = ref(false)
const progresoOCR = ref(0)
const mensaje = ref('')
const textoOCR = ref('')
const mostrarTextoOCR = ref(false)

const form = reactive({
  tipoDocumento: '',
  ruc: '',
  proveedor: '',
  serie: '',
  numero: '',
  fecha: '',
  total: '',
  moneda: ''
})

function seleccionarImagen(event) {
  const file = event.target.files?.[0]

  if (!file) {
    mensaje.value = 'No se seleccionó ninguna imagen.'
    return
  }

  if (!file.type.startsWith('image/')) {
    mensaje.value = 'El archivo seleccionado no es una imagen.'
    return
  }

  if (imagenOriginalPreview.value) {
    URL.revokeObjectURL(imagenOriginalPreview.value)
  }

  if (imagenPreview.value) {
    URL.revokeObjectURL(imagenPreview.value)
  }

  imagenOriginalPreview.value = URL.createObjectURL(file)

  imagenFile.value = null
  imagenPreview.value = ''
  mostrarEditorRecorte.value = true

  datosProcesados.value = false
  textoOCR.value = ''
  mostrarTextoOCR.value = false
  progresoOCR.value = 0

  limpiarFormulario()

  mensaje.value = 'Imagen cargada. Ahora recorta el comprobante antes de procesarlo.'

  event.target.value = ''
}
function confirmarRecorte() {
  const result = cropperRef.value?.getResult()

  if (!result || !result.canvas) {
    mensaje.value = 'No se pudo obtener el recorte. Intenta nuevamente.'
    return
  }

  result.canvas.toBlob(
    (blob) => {
      if (!blob) {
        mensaje.value = 'No se pudo generar la imagen recortada.'
        return
      }

      const archivoRecortado = new File(
        [blob],
        'comprobante-recortado.jpg',
        { type: 'image/jpeg' }
      )

      imagenFile.value = archivoRecortado

      if (imagenPreview.value) {
        URL.revokeObjectURL(imagenPreview.value)
      }

      imagenPreview.value = URL.createObjectURL(archivoRecortado)

      mostrarEditorRecorte.value = false
      datosProcesados.value = false
      textoOCR.value = ''
      progresoOCR.value = 0

      limpiarFormulario()

      mensaje.value = 'Recorte aplicado. Ahora presiona Procesar.'
    },
    'image/jpeg',
    0.95
  )
}

function cancelarRecorte() {
  mostrarEditorRecorte.value = false
  imagenOriginalPreview.value = ''
  imagenFile.value = null
  imagenPreview.value = ''
  mensaje.value = 'Recorte cancelado. Toma otra foto.'
}


function generarVersionesOCR(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const img = new Image()

    reader.onload = () => {
      img.src = reader.result
    }

    img.onload = () => {
      try {
        const versiones = []

        const anchoObjetivo = 2400
        let escala = anchoObjetivo / img.width

        if (escala > 4) escala = 4
        if (escala < 1) escala = 1

        const width = Math.round(img.width * escala)
        const height = Math.round(img.height * escala)

        const crearCanvasBase = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          canvas.width = width
          canvas.height = height

          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)

          return { canvas, ctx }
        }

        const crearBlob = (canvas, nombre) => {
          return new Promise((res, rej) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  rej(new Error('No se pudo generar blob'))
                  return
                }

                res({
                  nombre,
                  blob
                })
              },
              'image/png',
              1
            )
          })
        }

        async function procesar() {
          // VERSIÓN 1: gris + contraste suave
          {
            const { canvas, ctx } = crearCanvasBase()
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]

              let gris = 0.299 * r + 0.587 * g + 0.114 * b

              // Contraste suave, bueno para tickets grises como Tottus
              gris = (gris - 128) * 1.7 + 128
              gris = Math.max(0, Math.min(255, gris))

              data[i] = gris
              data[i + 1] = gris
              data[i + 2] = gris
            }

            ctx.putImageData(imageData, 0, 0)
            versiones.push(await crearBlob(canvas, 'gris_contraste'))
          }

          // VERSIÓN 2: blanco y negro suave
          {
            const { canvas, ctx } = crearCanvasBase()
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            let suma = 0
            let total = 0

            for (let i = 0; i < data.length; i += 4) {
              const gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
              suma += gris
              total++
            }

            const promedio = suma / total
            const umbral = promedio - 15

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]

              let gris = 0.299 * r + 0.587 * g + 0.114 * b

              const valor = gris > umbral ? 255 : 0

              data[i] = valor
              data[i + 1] = valor
              data[i + 2] = valor
            }

            ctx.putImageData(imageData, 0, 0)
            versiones.push(await crearBlob(canvas, 'binario_suave'))
          }

          // VERSIÓN 3: blanco y negro más fuerte
          {
            const { canvas, ctx } = crearCanvasBase()
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]

              let gris = 0.299 * r + 0.587 * g + 0.114 * b

              gris = (gris - 128) * 2.2 + 128
              gris = Math.max(0, Math.min(255, gris))

              const valor = gris > 150 ? 255 : 0

              data[i] = valor
              data[i + 1] = valor
              data[i + 2] = valor
            }

            ctx.putImageData(imageData, 0, 0)
            versiones.push(await crearBlob(canvas, 'binario_fuerte'))
          }


          // VERSIÓN 4: binario suave + dilatación
          {
            const { canvas, ctx } = crearCanvasBase()
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            let suma = 0
            let total = 0

            for (let i = 0; i < data.length; i += 4) {
              const gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
              suma += gris
              total++
            }

            const promedio = suma / total
            const umbral = promedio - 15

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]

              const gris = 0.299 * r + 0.587 * g + 0.114 * b
              const valor = gris > umbral ? 255 : 0

              data[i] = valor
              data[i + 1] = valor
              data[i + 2] = valor
              data[i + 3] = 255
            }

            let binaria = new ImageData(
              new Uint8ClampedArray(imageData.data),
              imageData.width,
              imageData.height
            )

            binaria = dilatarImageData(binaria, 1)

            ctx.putImageData(binaria, 0, 0)
            versiones.push(await crearBlob(canvas, 'binario_dilatado'))
          }
          


          // VERSIÓN 5: binario suave + cierre morfológico
          {
            const { canvas, ctx } = crearCanvasBase()
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            let suma = 0
            let total = 0

            for (let i = 0; i < data.length; i += 4) {
              const gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
              suma += gris
              total++
            }

            const promedio = suma / total
            const umbral = promedio - 15

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]

              const gris = 0.299 * r + 0.587 * g + 0.114 * b
              const valor = gris > umbral ? 255 : 0

              data[i] = valor
              data[i + 1] = valor
              data[i + 2] = valor
              data[i + 3] = 255
            }

            let binaria = new ImageData(
              new Uint8ClampedArray(imageData.data),
              imageData.width,
              imageData.height
            )

            binaria = closingImageData(binaria, 1)

            ctx.putImageData(binaria, 0, 0)
            versiones.push(await crearBlob(canvas, 'binario_closing'))
          }
          resolve(versiones)
        }

        procesar()

      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('No se pudo cargar la imagen'))
    }

    reader.onerror = () => {
      reject(new Error('No se pudo leer la imagen'))
    }

    reader.readAsDataURL(file)
  })
}


async function procesarImagen() {
  if (!imagenFile.value) {
    mensaje.value = 'Primero debes tomar o seleccionar una foto.'
    return
  }

  let worker = null

  try {
    procesando.value = true
    datosProcesados.value = false
    progresoOCR.value = 0
    mensaje.value = 'Preparando imagen para OCR...'

    const { createWorker } = await import('tesseract.js')

    worker = await createWorker('spa+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          progresoOCR.value = Math.round(m.progress * 100)
        }
      }
    })

    await worker.setParameters({
      tessedit_pageseg_mode: '4',
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    })

    mensaje.value = 'Generando versiones mejoradas de la imagen...'

    const versiones = await generarVersionesOCR(imagenFile.value)

    let mejorResultado = null
    let mejorTexto = ''
    let mejorConfianza = -1

    for (let i = 0; i < versiones.length; i++) {
      mensaje.value = `Procesando versión ${i + 1} de ${versiones.length}...`

      const result = await worker.recognize(versiones[i].blob)

      const texto = result.data.text || ''
      const confianza = result.data.confidence || 0

      console.log('Versión OCR:', versiones[i].nombre, confianza, texto)

      if (confianza > mejorConfianza && texto.trim().length > 10) {
        mejorConfianza = confianza
        mejorResultado = result
        mejorTexto = texto
      }
    }

    textoOCR.value = mejorTexto

    const datos = extraerDatos(textoOCR.value)

    form.tipoDocumento = datos.tipoDocumento
    form.ruc = datos.ruc
    form.proveedor = datos.proveedor
    form.serie = datos.serie
    form.numero = datos.numero
    form.fecha = datos.fecha
    form.total = datos.total
    form.moneda = datos.moneda
    

    datosProcesados.value = true
    mensaje.value = `OCR terminado. Confianza aproximada: ${Math.round(mejorConfianza)}%. Revisa antes de subir.`

  } catch (error) {
    console.error('Error OCR:', error)
    mensaje.value = 'Error al procesar la imagen. Prueba recortando mejor o tomando la foto más cerca.'
  } finally {
    if (worker) {
      await worker.terminate()
    }

    procesando.value = false
  }
}


function preprocesarImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const img = new Image()

    reader.onload = () => {
      img.src = reader.result
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const anchoObjetivo = 2200
        let escala = anchoObjetivo / img.width

        if (escala > 3) {
          escala = 3
        }

        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let suma = 0
        let cantidad = 0

        // Primero calculamos brillo promedio
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          const gris = 0.299 * r + 0.587 * g + 0.114 * b

          suma += gris
          cantidad++
        }

        const promedio = suma / cantidad

        // Umbral dinámico según la foto
        const umbral = promedio > 160 ? promedio - 25 : promedio

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          let gris = 0.299 * r + 0.587 * g + 0.114 * b

          // Contraste suave
          gris = gris < umbral ? gris * 0.65 : gris * 1.25

          // Blanco y negro
          const valor = gris > umbral ? 255 : 0

          data[i] = valor
          data[i + 1] = valor
          data[i + 2] = valor
        }

        ctx.putImageData(imageData, 0, 0)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('No se pudo generar imagen procesada'))
              return
            }

            resolve(blob)
          },
          'image/png',
          1
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('No se pudo cargar la imagen'))
    }

    reader.onerror = () => {
      reject(new Error('No se pudo leer el archivo'))
    }

    reader.readAsDataURL(file)
  })
}



function extraerMoneda(textoOriginal) {
  const lineas = obtenerLineas(textoOriginal)

  const etiquetasTotal = [
    /IMPORTE\s+TOTAL/,
    /TOTAL\s+NETO/,
    /TOTAL\s+A\s+PAGAR/,
    /TOTAL\s+GENERAL/,
    /TOTAL\s+VENTA/,
    /TOTAL\s+DE\s+VENTA/,
    /MONTO\s+TOTAL(?!\s+TRIBUTOS)/,
    /TOTAL\s+COMPROBANTE/,
    /CONTADO/,
    /EFECTIVO/,
    /TARJETA/,
    /VISA/,
    /MASTERCARD/
  ]

  // Primero busca moneda cerca de líneas de total o pago
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (etiquetasTotal.some(patron => patron.test(linea))) {
      const bloque = [
        lineas[i - 1] || '',
        lineas[i] || '',
        lineas[i + 1] || ''
      ].join(' ')

      const moneda = detectarMonedaEnTexto(bloque)

      if (moneda) return moneda
    }
  }

  // Si no encuentra cerca del total, busca en todo el texto
  const texto = limpiarTextoPlano(textoOriginal)
  const monedaGeneral = detectarMonedaEnTexto(texto)

  if (monedaGeneral) return monedaGeneral

  // En Perú, si no aparece símbolo, por defecto suele ser PEN
  return 'PEN'
}


function detectarMonedaEnTexto(texto) {
  const t = normalizarOCR(texto)

  if (
    /\bUSD\b/.test(t) ||
    /\bUS\$/.test(t) ||
    /\bDOLARES\b/.test(t) ||
    /\bDOLAR\b/.test(t)
  ) {
    return 'USD'
  }

  if (
    /\bPEN\b/.test(t) ||
    /\bSOLES\b/.test(t) ||
    /\bSOL\b/.test(t) ||
    /\bS\/\b/.test(t)
  ) {
    return 'PEN'
  }

  return ''
}


function normalizarSimbolosMoneda(texto) {
  let t = String(texto || '')

  // Soles mal leídos por OCR
  t = t
    .replace(/\$\s*\/\s*(?=\d)/g, 'PEN ')
    .replace(/\$\s*(?=\d{1,6}(?:[.,\-]|\s)\d{2})/g, 'PEN ')
    .replace(/§\s*\/?\s*(?=\d)?/g, 'PEN ')
    .replace(/\bS\s*\/\s*\.?\s*(?=\d)?/gi, 'PEN ')
    .replace(/\bS\s*[I1l|]\s*(?=\d)/gi, 'PEN ')
    .replace(/\b5\s*\/\s*(?=\d)/gi, 'PEN ')
    .replace(/\bSOLES\b/gi, 'PEN')
    .replace(/\bSOL\b/gi, 'PEN')
    .replace(/\bPEN\b/gi, 'PEN')

  // Dólares reales
  t = t
    .replace(/\bU\s*S\s*\$\s*/gi, 'USD ')
    .replace(/\bUS\s*\$\s*/gi, 'USD ')
    .replace(/\bUSD\b/gi, 'USD')
    .replace(/\bDOLARES\b/gi, 'USD')
    .replace(/\bDÓLARES\b/gi, 'USD')
    .replace(/\bDOLAR\b/gi, 'USD')
    .replace(/\bDÓLAR\b/gi, 'USD')

  // Montos con guion por OCR: 15-90 => 15.90
  t = t.replace(/\b(\d{1,6})\s*[-]\s*(\d{2})\b/g, '$1.$2')

  return t
}







const PROVEEDORES_CONOCIDOS = {
  '20508565934': 'HIPERMERCADOS TOTTUS S.A.',
  '20508655934': 'HIPERMERCADOS TOTTUS S.A.',
  '20100111838': 'GRIFOS ESPINOZA S.A.'
}

function extraerProveedorPorRUC(ruc) {
  return PROVEEDORES_CONOCIDOS[String(ruc || '').trim()] || ''
}

function extraerProveedor(textoOriginal) {
  const lineas = obtenerLineas(textoOriginal)

  const indiceDocumento = lineas.findIndex(linea =>
    /FACTURA|BOLETA|GUIA|GUIA DE REMISION|NOTA DE CREDITO|NOTA DE DEBITO|TICKET|RECIBO/.test(linea)
  )

  const limite = indiceDocumento > 0 ? indiceDocumento : Math.min(12, lineas.length)
  const encabezado = lineas.slice(0, limite)

  const palabrasNoProveedor = /RUC|AUC|AV\.?|AU\.?|JR\.?|JIRON|CAL\.?|CALLE|URB\.?|INT\.?|PISO|LIMA|LOCAL|TERMINAL|CAJERO|DIRECCION|DIR\.?|TELEF|TELF|HORA|FECHA|BOLETA|FACTURA|GUIA|NRO|NUMERO/

  const limpiarNombre = (linea) => {
    return String(linea || '')
      .replace(/\b(10|20)\d{9}\b/g, '')
      .replace(/RUC\s*:?\s*/g, '')
      .replace(/AUC\s*:?\s*/g, '')
      .replace(/[-–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  for (const linea of encabezado) {
    const limpia = limpiarNombre(linea)

    if (
      limpia.length >= 4 &&
      /(S\.?\s*A\.?\s*C\.?|S\.?\s*A\.?|SAC|SA|E\.?\s*I\.?\s*R\.?\s*L\.?|EIRL|S\.?\s*R\.?\s*L\.?|SRL)/.test(limpia)
    ) {
      return limpia
    }
  }

  for (const linea of encabezado) {
    const limpia = limpiarNombre(linea)

    if (
      limpia.length >= 4 &&
      !palabrasNoProveedor.test(limpia) &&
      !/^\d+$/.test(limpia)
    ) {
      return limpia
    }
  }

  return ''
}



function extraerDatos(textoOriginal) {
  const documento = extraerDocumento(textoOriginal)
  const ruc = extraerRUCProveedor(textoOriginal)

  return {
    tipoDocumento: identificarTipoDocumento(textoOriginal, documento.serie),
    ruc,
    proveedor: extraerProveedorPorRUC(ruc) || extraerProveedor(textoOriginal),
    serie: documento.serie,
    numero: documento.numero,
    fecha: extraerFecha(textoOriginal),
    total: extraerTotal(textoOriginal),
    moneda: extraerMoneda(textoOriginal)
  }
}



function normalizarOCR(texto) {
  return normalizarSimbolosMoneda(String(texto || ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[|]/g, ' ')
    .replace(/T0TAL/g, 'TOTAL')
    .replace(/T0T4L/g, 'TOTAL')
    .replace(/IMP0RTE/g, 'IMPORTE')
    .replace(/INPORTE/g, 'IMPORTE')
    .replace(/INP0RTE/g, 'IMPORTE')
    .replace(/IMPCRTE/g, 'IMPORTE')
    .replace(/I6V/g, 'IGV')
    .replace(/16V/g, 'IGV')
    .replace(/AUC/g, 'RUC')
    .replace(/B0LETA/g, 'BOLETA')
    .replace(/BOLFTA/g, 'BOLETA')
    .replace(/FACTVRA/g, 'FACTURA')
    .replace(/R\.?\s*U\.?\s*C\.?/g, 'RUC')
}




function extraerRUCProveedor(textoOriginal) {
  const lineas = obtenerLineas(textoOriginal)

  const indiceDocumento = lineas.findIndex(linea =>
    /FACTURA|BOLETA|GUIA|GUIA DE REMISION|NOTA DE CREDITO|NOTA DE DEBITO/.test(linea)
  )

  const zonaEmisor = indiceDocumento > 0
    ? lineas.slice(0, indiceDocumento).join(' ')
    : lineas.slice(0, 12).join(' ')

  const rucEmisor = zonaEmisor.match(/\b(10|20)\d{9}\b/)

  if (rucEmisor) return rucEmisor[0]

  const rucGeneral = limpiarTextoPlano(textoOriginal).match(/\b(10|20)\d{9}\b/)

  return rucGeneral ? rucGeneral[0] : ''
}

function obtenerLineas(texto) {
  return normalizarOCR(texto)
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(linea => linea.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
}

function limpiarTextoPlano(texto) {
  return obtenerLineas(texto).join(' ')
}

function limpiarTexto(texto) {
  return texto
    .replace(/\r/g, '\n')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerRUC(texto) {
  const match = texto.match(/\b(10|20)\d{9}\b/)
  return match ? match[0] : ''
}

function extraerDocumento(textoOriginal) {
  const texto = limpiarTextoPlano(textoOriginal)

  const patrones = [
    /(?:FACTURA|BOLETA|GUIA|NOTA)\s*(?:DE\s*VENTA)?\s*(?:ELECTRONICA)?\s*(?:NO\.?|NRO\.?)?\s*([FBT][A-Z0-9]{2,3})[-\s]*(\d{4,10})/i,
    /\b([FBT][A-Z0-9]{2,3})[-\s]+(\d{4,10})\b/i,
    /\b([FBT][A-Z0-9]{2,3})(\d{6,10})\b/i
  ]

  for (const patron of patrones) {
    const match = texto.match(patron)

    if (match) {
      return {
        serie: match[1].toUpperCase(),
        numero: match[2]
      }
    }
  }

  return {
    serie: '',
    numero: ''
  }
}

function extraerFecha(textoOriginal) {
  const texto = limpiarTextoPlano(textoOriginal)

  const fechaNormal = texto.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/)
  if (fechaNormal) {
    return fechaNormal[0].replaceAll('-', '/')
  }

  const fechaInvertida = texto.match(/\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/)
  if (fechaInvertida) {
    const partes = fechaInvertida[0].split(/[\/\-]/)
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  return ''
}



function clonarImageData(imageData) {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  )
}

function dilatarImageData(imageData, iteraciones = 1) {
  let actual = clonarImageData(imageData)

  for (let it = 0; it < iteraciones; it++) {
    const origen = actual.data
    const salida = new Uint8ClampedArray(origen)
    const width = actual.width
    const height = actual.height

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let negroEncontrado = false

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4
            const valor = origen[idx] // R, porque ya está en binario

            if (valor === 0) {
              negroEncontrado = true
              break
            }
          }
          if (negroEncontrado) break
        }

        const i = (y * width + x) * 4
        const nuevoValor = negroEncontrado ? 0 : 255

        salida[i] = nuevoValor
        salida[i + 1] = nuevoValor
        salida[i + 2] = nuevoValor
        salida[i + 3] = 255
      }
    }

    actual = new ImageData(salida, actual.width, actual.height)
  }

  return actual
}

function erosionarImageData(imageData, iteraciones = 1) {
  let actual = clonarImageData(imageData)

  for (let it = 0; it < iteraciones; it++) {
    const origen = actual.data
    const salida = new Uint8ClampedArray(origen)
    const width = actual.width
    const height = actual.height

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let todosNegros = true

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4
            const valor = origen[idx]

            if (valor !== 0) {
              todosNegros = false
              break
            }
          }
          if (!todosNegros) break
        }

        const i = (y * width + x) * 4
        const nuevoValor = todosNegros ? 0 : 255

        salida[i] = nuevoValor
        salida[i + 1] = nuevoValor
        salida[i + 2] = nuevoValor
        salida[i + 3] = 255
      }
    }

    actual = new ImageData(salida, actual.width, actual.height)
  }

  return actual
}

function closingImageData(imageData, iteraciones = 1) {
  const dilatada = dilatarImageData(imageData, iteraciones)
  return erosionarImageData(dilatada, iteraciones)
}

function esLineaNoMontoFinal(linea) {
  return /RUC|DNI|FECHA|HORA|LOCAL|TERMINAL|SECUENCIA|CAJERO|CF\.?E?N?P?|EMP|CODIGO|ITEMS|NUMERO DE ITEMS|NRO|NO\.|BOLETA|FACTURA|GUIA|DIRECCION|AV\.|JR\.|CALLE/.test(linea)
}

function obtenerCandidatosMontos(textoOriginal) {
  const lineas = obtenerLineas(textoOriginal)
  const candidatos = []

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (esLineaNoMontoFinal(linea)) continue

    // Si la línea es solo impuestos/porcentajes, no debe competir como total
    const lineaEsTributo = /IGV|I\.G\.V|ISC|TRIBUTOS|OP\.?\s*GRAVADA|OPERACION\s+GRAVADA/.test(linea)
    const tieneCantidadPrecio = /\b\d+\s*X\s*\d{1,6}[.,]\d{2}\b/.test(linea)
    const esLineaTotal = /IMPORTE\s+TOTAL|TOTAL\s+A\s+PAGAR|TOTAL\s+NETO|TOTAL\s+GENERAL/.test(linea)

    if (lineaEsTributo && !tieneCantidadPrecio && !esLineaTotal) {
      continue
    }

    const montos = extraerMontosDeLinea(linea)

    for (const monto of montos) {
      const valor = convertirMontoANumero(monto)

      if (valor <= 0 || valor >= 100000) continue

      let puntaje = 0

      if (/IMPORTE\s+TOTAL|TOTAL\s+A\s+PAGAR|TOTAL\s+NETO|TOTAL\s+GENERAL/.test(linea)) puntaje += 100
      if (/PEN|USD|S\/|\$/.test(linea)) puntaje += 20
      if (/\b\d+\s*X\s*\d{1,6}[.,]\d{2}\b/.test(linea)) puntaje += 50
      if (/PRECIO|CANT|VALOR|DESCRIPCION/.test(linea)) puntaje += 5

      candidatos.push({
        monto: limpiarMonto(monto),
        valor,
        linea,
        indice: i,
        puntaje
      })
    }
  }

  return candidatos
}

function extraerTotalPorRepeticion(textoOriginal) {
  const candidatos = obtenerCandidatosMontos(textoOriginal)

  if (candidatos.length === 0) return ''

  const conteo = {}

  for (const c of candidatos) {
    if (!conteo[c.monto]) {
      conteo[c.monto] = {
        monto: c.monto,
        valor: c.valor,
        veces: 0,
        puntaje: 0
      }
    }

    conteo[c.monto].veces += 1
    conteo[c.monto].puntaje += c.puntaje
  }

  const agrupados = Object.values(conteo)

  agrupados.sort((a, b) => {
    if (b.veces !== a.veces) return b.veces - a.veces
    if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje
    return b.valor - a.valor
  })

  return agrupados[0]?.monto || ''
}

function extraerTotalPorItemUnico(textoOriginal) {
  const lineas = obtenerLineas(textoOriginal)

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    // Ejemplo: 1 X 15.90
    const matchCantidadPrecio = linea.match(/\b\d+\s*X\s*(\d{1,6}[.,]\d{2})\b/i)
    if (matchCantidadPrecio) {
      return limpiarMonto(matchCantidadPrecio[1])
    }

    // Ejemplo: ALMOHADA ENROLLA PEN 15.90
    if (/PEN|USD/.test(linea) && !esLineaNoMontoFinal(linea)) {
      const montos = extraerMontosDeLinea(linea)
      if (montos.length > 0) {
        return limpiarMonto(montos[montos.length - 1])
      }
    }
  }

  return ''
}


function extraerTotal(textoOriginal) {
  const lineas = obtenerLineas(textoOriginal)

  const etiquetasFinales = [
    /IMPORTE\s+TOTAL/,
    /TOTAL\s+A\s+PAGAR/,
    /TOTAL\s+NETO/,
    /TOTAL\s+GENERAL/,
    /TOTAL\s+VENTA/,
    /TOTAL\s+DE\s+VENTA/,
    /MONTO\s+TOTAL(?!\s+TRIBUTOS)/,
    /TOTAL\s+COMPROBANTE/,
    /TOTAL\s+FINAL/
  ]

  const etiquetasExcluir = [
    /SUB\s*TOTAL/,
    /SUBTOTAL/,
    /OP\.?\s*GRAVADA/,
    /OPERACION\s+GRAVADA/,
    /IGV/,
    /I\.G\.V/,
    /ISC/,
    /TOTAL\s+BRUTO/,
    /TOTAL\s+DEL\s+VALOR\s+VENTA/,
    /MONTO\s+TOTAL\s+TRIBUTOS/,
    /DESCUENTO/,
    /DSCTO/,
    /VUELTO/,
    /CAMBIO/,
    /DNI/,
    /RUC/,
    /FECHA/,
    /HORA/
  ]

  function esEtiquetaFinal(linea) {
    return etiquetasFinales.some(patron => patron.test(linea))
  }

  function esEtiquetaExcluida(linea) {
    return etiquetasExcluir.some(patron => patron.test(linea))
  }

  // 1. Buscar por etiqueta final
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (esEtiquetaFinal(linea) && !esEtiquetaExcluida(linea)) {
      const bloque = [
        lineas[i] || '',
        lineas[i + 1] || '',
        lineas[i + 2] || '',
        lineas[i + 3] || '',
        lineas[i + 4] || ''
      ].join(' ')

      const montosBloque = extraerMontosDeLinea(bloque)

      if (montosBloque.length > 0) {
        return limpiarMonto(montosBloque[montosBloque.length - 1])
      }
    }
  }

  // 2. Si el OCR no puso monto junto a IMPORTE TOTAL, buscar precio final tipo "1 X 15.90"
  const porItemUnico = extraerTotalPorItemUnico(textoOriginal)
  if (porItemUnico) return porItemUnico

  // 3. Luego buscar por repetición de montos válidos
  const porRepeticion = extraerTotalPorRepeticion(textoOriginal)
  if (porRepeticion) return porRepeticion

  // 4. Último respaldo: mayor monto válido, ya sin porcentajes
  const candidatos = obtenerCandidatosMontos(textoOriginal)

  if (candidatos.length === 0) return ''

  candidatos.sort((a, b) => {
    if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje
    return b.valor - a.valor
  })

  return limpiarMonto(candidatos[0].monto)
}


function identificarTipoDocumento(textoOriginal, serie = '') {
  const texto = limpiarTextoPlano(textoOriginal)
  const serieMayus = String(serie || '').toUpperCase()

  if (/NOTA\s+DE\s+CREDITO/.test(texto)) {
    return 'Nota de crédito'
  }

  if (/NOTA\s+DE\s+DEBITO/.test(texto)) {
    return 'Nota de débito'
  }

  if (/GUIA\s+DE\s+REMISION|GUIA/.test(texto) || serieMayus.startsWith('T')) {
    return 'Guía'
  }

  if (/FACTURA|FACTURA\s+DE\s+VENTA|FACTURA\s+ELECTRONICA/.test(texto) || serieMayus.startsWith('F')) {
    return 'Factura'
  }

  if (/BOLETA|BOLETA\s+DE\s+VENTA|BOLETA\s+ELECTRONICA/.test(texto) || serieMayus.startsWith('B')) {
    return 'Boleta'
  }

  if (/TICKET|RECIBO/.test(texto)) {
    return 'Ticket / Recibo'
  }

  return 'Otro'
}

function quitarPorcentajes(texto) {
  return String(texto || '')
    .replace(/\b\d{1,3}(?:[.,]\d{1,2})?\s*%/g, ' ')
}



function extraerMontosDeLinea(linea) {
  let texto = normalizarSimbolosMoneda(String(linea || ''))

  // Evita que 18,00% sea leído como S/ 18.00
  texto = quitarPorcentajes(texto)

  texto = texto
    .replace(/\b(\d{1,6})\s+(\d{2})\b/g, '$1.$2')
    .replace(/\b(\d{1,6})-(\d{2})\b/g, '$1.$2')

  const regex = /(?:PEN|USD)?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d{1,6}[.,]\d{2})/gi

  const montos = []
  let match

  while ((match = regex.exec(texto)) !== null) {
    montos.push(match[1])
  }

  return montos
}

function limpiarMonto(monto) {
  let m = normalizarSimbolosMoneda(String(monto || ''))
    .replace(/\b(\d{1,6})\s+(\d{2})\b/g, '$1.$2')
    .replace(/\b(\d{1,6})-(\d{2})\b/g, '$1.$2')
    .replace(/\bPEN\b/gi, '')
    .replace(/\bUSD\b/gi, '')
    .replace(/S\//gi, '')
    .replace(/\$/g, '')
    .replace(/[^\d.,]/g, '')
    .trim()

  if (!m) return ''

  const tieneComa = m.includes(',')
  const tienePunto = m.includes('.')

  if (tieneComa && tienePunto) {
    if (m.lastIndexOf(',') > m.lastIndexOf('.')) {
      m = m.replace(/\./g, '').replace(',', '.')
    } else {
      m = m.replace(/,/g, '')
    }
  } else if (tieneComa) {
    m = m.replace(',', '.')
  }

  const numero = Number(m)

  if (!Number.isFinite(numero)) return ''

  return numero.toFixed(2)
}

function convertirMontoANumero(monto) {
  const limpio = limpiarMonto(monto)
  const numero = Number(limpio)

  return Number.isFinite(numero) ? numero : 0
}













async function subirDatos() {
  if (!datosProcesados.value) {
    mensaje.value = 'Primero debes procesar la imagen.'
    return
  }

  try {
    mensaje.value = 'Subiendo datos a Google Sheets...'

    const datos = {
      tipoDocumento: form.tipoDocumento,
      ruc: form.ruc,
      proveedor: form.proveedor,
      serie: form.serie,
      numero: form.numero,
      fecha: form.fecha,
      total: form.total,
      moneda: form.moneda,
      estado: 'Procesado',
      textoOCR: textoOCR.value
    }

    const response = await $fetch('/api/comprobantes', {
      method: 'POST',
      body: datos
    })

    console.log('Respuesta /api/comprobantes:', response)

    if (response.success) {
      mensaje.value = 'Comprobante guardado correctamente en Google Sheets.'
    } else {
      mensaje.value = `Error en ${response.etapa || 'proceso'}: ${response.message || 'No se pudo guardar'}`
      console.error('Detalle del error:', response)
    }

  } catch (error) {
    console.error('Error final al subir:', error)
    mensaje.value = 'Error al subir los datos. Revisa la consola.'
  }
}

function limpiarFormulario() {
  form.tipoDocumento = ''
  form.ruc = ''
  form.proveedor = ''
  form.serie = ''
  form.numero = ''
  form.fecha = ''
  form.total = ''
  form.moneda = ''
}
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  color: #111827;
}

.page {
  min-height: 100vh;
  padding: 20px;
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-width: 520px;
  background: white;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

h1 {
  margin: 0;
  font-size: 26px;
}

h2 {
  font-size: 18px;
  margin-top: 22px;
}

.subtitle {
  color: #6b7280;
  font-size: 14px;
  line-height: 1.5;
}

.upload-box {
  margin-top: 20px;
  border: 2px dashed #9ca3af;
  border-radius: 16px;
  padding: 24px;
  display: block;
  text-align: center;
  cursor: pointer;
  background: #f9fafb;
}

.upload-box input {
  display: none;
}

.upload-box span {
  font-size: 16px;
  font-weight: bold;
}

.preview-container {
  margin-top: 20px;
}

.preview {
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}

.buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 14px;
  color: white;
  font-weight: bold;
  cursor: pointer;
  font-size: 15px;
}

.btn:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.primary {
  background: #2563eb;
}

.success {
  background: #16a34a;
}

.progress-box {
  margin-top: 18px;
  background: #eff6ff;
  padding: 14px;
  border-radius: 12px;
  color: #1e40af;
}

.progress-box p {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.progress {
  width: 100%;
  height: 10px;
  background: #bfdbfe;
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #2563eb;
  transition: width 0.2s;
}

.form {
  margin-top: 10px;
}

label {
  display: block;
  margin-top: 14px;
  font-size: 14px;
  font-weight: bold;
}

input {
  width: 100%;
  margin-top: 6px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  font-size: 15px;
}

.ocr-box {
  margin-top: 20px;
  padding: 14px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.ocr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ocr-header h2 {
  margin: 0;
}

.btn-small {
  border: none;
  background: #111827;
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}

pre {
  margin-top: 12px;
  white-space: pre-wrap;
  font-size: 13px;
  background: white;
  border-radius: 10px;
  padding: 12px;
  max-height: 280px;
  overflow: auto;
}

.message {
  margin-top: 20px;
  padding: 12px;
  border-radius: 12px;
  background: #ecfdf5;
  color: #065f46;
  font-size: 14px;
}


.crop-modal {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.92);
  z-index: 9999;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crop-card {
  width: 100%;
  max-width: 560px;
  background: white;
  border-radius: 18px;
  padding: 18px;
}

.crop-card h2 {
  margin-top: 0;
}

.crop-help {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
}

.cropper {
  width: 100%;
  height: 430px;
  background: #111827;
  border-radius: 14px;
  overflow: hidden;
}

.crop-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.cancel {
  background: #6b7280;
}

</style>