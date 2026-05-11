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
  total: ''
})

function seleccionarImagen(event) {
  const file = event.target.files[0]

  if (!file) return

  imagenFile.value = file
  imagenPreview.value = URL.createObjectURL(file)

  datosProcesados.value = false
  textoOCR.value = ''
  mostrarTextoOCR.value = false
  progresoOCR.value = 0
  mensaje.value = 'Imagen cargada correctamente. Ahora presiona Procesar.'

  limpiarFormulario()
}

async function procesarImagen() {
  if (!imagenFile.value) {
    mensaje.value = 'Primero debes tomar o seleccionar una foto.'
    return
  }

  try {
    procesando.value = true
    datosProcesados.value = false
    progresoOCR.value = 0
    mensaje.value = 'Leyendo imagen. Espera unos segundos...'

    /*
      Importación dinámica:
      Esto evita problemas con Nuxt/SSR porque Tesseract se carga solo en el navegador.
    */
    const { createWorker } = await import('tesseract.js')

    const worker = await createWorker('spa', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          progresoOCR.value = Math.round(m.progress * 100)
        }
      }
    })

    const result = await worker.recognize(imagenFile.value)

    textoOCR.value = result.data.text || ''

    await worker.terminate()

    const datos = extraerDatos(textoOCR.value)

    form.tipoDocumento = datos.tipoDocumento
    form.ruc = datos.ruc
    form.proveedor = datos.proveedor
    form.serie = datos.serie
    form.numero = datos.numero
    form.fecha = datos.fecha
    form.total = datos.total

    datosProcesados.value = true
    mensaje.value = 'OCR terminado. Revisa los campos antes de subir.'
  } catch (error) {
    console.error(error)
    mensaje.value = 'Error al procesar la imagen. Prueba con una foto más clara.'
  } finally {
    procesando.value = false
  }
}

function extraerDatos(textoOriginal) {
  const texto = limpiarTexto(textoOriginal)

  const ruc = extraerRUC(texto)
  const documento = extraerDocumento(texto)
  const fecha = extraerFecha(texto)
  const total = extraerTotal(texto)
  const proveedor = extraerProveedor(texto)
  const tipoDocumento = identificarTipoDocumento(texto, documento.serie)

  return {
    tipoDocumento,
    ruc,
    proveedor,
    serie: documento.serie,
    numero: documento.numero,
    fecha,
    total
  }
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

function extraerDocumento(texto) {
  /*
    Busca formatos comunes:
    F001-000123
    B001-000123
    E001-000123
    T001-000123
    F001 000123
  */

  const match = texto.match(/\b([FBET]\d{3})[-\s]?(\d{4,10})\b/i)

  if (!match) {
    return {
      serie: '',
      numero: ''
    }
  }

  return {
    serie: match[1].toUpperCase(),
    numero: match[2]
  }
}

function extraerFecha(texto) {
  /*
    Busca fechas:
    09/05/2026
    09-05-2026
    2026-05-09
  */

  const fechaNormal = texto.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/)
  if (fechaNormal) return fechaNormal[0].replaceAll('-', '/')

  const fechaInvertida = texto.match(/\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/)
  if (fechaInvertida) {
    const partes = fechaInvertida[0].split(/[\/\-]/)
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  return ''
}

function extraerTotal(texto) {
  /*
    Busca montos cerca de palabras como:
    TOTAL
    IMPORTE TOTAL
    TOTAL A PAGAR
  */

  const patrones = [
    /total\s*a\s*pagar\s*s?\/?\s*([\d,.]+)/i,
    /importe\s*total\s*s?\/?\s*([\d,.]+)/i,
    /total\s*s?\/?\s*([\d,.]+)/i,
    /monto\s*total\s*s?\/?\s*([\d,.]+)/i
  ]

  for (const patron of patrones) {
    const match = texto.match(patron)
    if (match) {
      return limpiarMonto(match[1])
    }
  }

  /*
    Si no encuentra palabra TOTAL, toma el monto más grande detectado.
  */

  const montos = texto.match(/\b\d{1,5}[,.]\d{2}\b/g)

  if (!montos || montos.length === 0) return ''

  const montosNumericos = montos.map((m) => ({
    original: m,
    valor: Number(m.replace(',', '.'))
  }))

  montosNumericos.sort((a, b) => b.valor - a.valor)

  return limpiarMonto(montosNumericos[0].original)
}

function limpiarMonto(monto) {
  return monto
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
}

function extraerProveedor(texto) {
  /*
    Versión simple:
    intenta tomar el texto antes del RUC.
    Luego lo mejoraremos con reglas más finas.
  */

  const rucIndex = texto.search(/\b(10|20)\d{9}\b/)

  if (rucIndex > 0) {
    const antesDelRuc = texto.substring(0, rucIndex).trim()
    const palabras = antesDelRuc.split(' ')

    return palabras.slice(0, 8).join(' ')
  }

  return ''
}

function identificarTipoDocumento(texto, serie) {
  const textoMayus = texto.toUpperCase()

  if (textoMayus.includes('FACTURA') || serie.startsWith('F')) {
    return 'Factura'
  }

  if (textoMayus.includes('BOLETA') || serie.startsWith('B')) {
    return 'Boleta'
  }

  if (textoMayus.includes('GUIA') || textoMayus.includes('GUÍA') || serie.startsWith('T')) {
    return 'Guía'
  }

  return 'Otro'
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
</style>