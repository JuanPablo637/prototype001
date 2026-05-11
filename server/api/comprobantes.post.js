export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()

    console.log('========== DEBUG /api/comprobantes ==========')
    console.log('appsScriptUrl:', config.appsScriptUrl)
    console.log('appsScriptSecret existe:', !!config.appsScriptSecret)
    console.log('body recibido:', body)

    if (!config.appsScriptUrl) {
      return {
        success: false,
        etapa: 'ENV',
        message: 'No existe APPS_SCRIPT_URL. Revisa tu archivo .env y reinicia Nuxt.'
      }
    }

    if (!config.appsScriptSecret) {
      return {
        success: false,
        etapa: 'ENV',
        message: 'No existe APPS_SCRIPT_SECRET. Revisa tu archivo .env y reinicia Nuxt.'
      }
    }

    const payload = {
      ...body,
      api_key: config.appsScriptSecret
    }

    const respuestaTexto = await $fetch(config.appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      responseType: 'text'
    })

    console.log('Respuesta cruda Apps Script:', respuestaTexto)

    let respuestaJSON

    try {
      respuestaJSON = JSON.parse(respuestaTexto)
    } catch (error) {
      return {
        success: false,
        etapa: 'APPS_SCRIPT_NO_DEVOLVIO_JSON',
        message: 'Apps Script no devolvió JSON. Puede ser error de permisos, URL incorrecta o pantalla HTML de Google.',
        respuesta: respuestaTexto.substring(0, 500)
      }
    }

    return respuestaJSON

  } catch (error) {
    console.error('ERROR REAL EN /api/comprobantes:', error)

    return {
      success: false,
      etapa: 'ERROR_FETCH',
      message: error?.message || 'Error desconocido',
      statusCode: error?.statusCode || null,
      statusMessage: error?.statusMessage || null,
      data: error?.data || null
    }
  }
})