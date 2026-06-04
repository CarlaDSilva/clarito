# Clarito

**La contabilidad doméstica casi invisible.**

Clarito es una aplicación web progresiva (PWA) para el seguimiento de gastos compartidos en el hogar. Diseñada para instalarse en el móvil como una app nativa, funciona sin tienda de aplicaciones, sin suscripciones y sin que tengas que pensar demasiado en ella.

-----

## Qué hace

### Escaneo de tickets con visión artificial

Fotografías un ticket de supermercado y Clarito lo lee. Extrae automáticamente los productos, los precios, el total y la tienda. El parser reconoce los formatos específicos de Mercadona, Lidl, Carrefour, Alcampo, Froiz, Gadis y otros. Lo que no reconoce, te lo presenta para que lo edites manualmente.

### Gestión de gastos compartidos

Cada ticket o gasto manual se asigna a una persona del hogar. Clarito calcula en todo momento quién debe a quién y cuánto, teniendo en cuenta repartos personalizados por producto (50/50, 70/30, asignación individual). Cuando las cuentas están saldadas, se registra la liquidación.

### Despensa estimada

A partir del historial de compras, Clarito predice cuándo se agotará cada producto. Muestra una lista de lo que probablemente necesitas reponer, ordenada por supermercado. Con un toque, exporta esa lista a la app de Recordatorios de iOS.

### Asistente de IA

Un asistente conversacional integrado responde preguntas sobre los gastos del hogar, analiza patrones y ofrece observaciones útiles. Conoce el contexto completo de la cuenta.

### Sincronización entre dispositivos

Los datos se sincronizan a través de un Gist privado de GitHub. Sin servidor propio, sin coste. Las imágenes de los tickets se almacenan en Cloudinary. Los datos sensibles (claves de API, tokens) nunca abandonan el dispositivo.

### Modo solo lectura

Una segunda persona puede acceder a los datos con solo el ID del Gist, sin token. Ve todo, puede consultar al asistente y exportar la lista de la compra a Recordatorios, pero no puede modificar nada.

-----

## Tecnología

|Capa                |Tecnología                          |
|--------------------|------------------------------------|
|Frontend            |HTML, CSS, JavaScript vanilla       |
|Instalación         |PWA — sin App Store                 |
|OCR                 |Google Cloud Vision API             |
|IA                  |Groq API (Llama 3.3 y Llama 4 Scout)|
|Sincronización      |GitHub Gist API                     |
|Imágenes            |Cloudinary                          |
|Almacenamiento local|localStorage + IndexedDB            |
|Hosting             |GitHub Pages                        |

No hay backend propio. No hay base de datos central. No hay servidor que mantener.

-----

## Privacidad por diseño

- Los datos se guardan en el dispositivo del usuario
- Las claves de API nunca se exportan ni se sincronizan
- El Gist es privado y solo accesible con el ID o el token
- Las imágenes en Cloudinary se eliminan automáticamente junto con los tickets al cumplirse 60 días
- Clarito no tiene publicidad, no recopila datos de uso y no envía nada a servidores propios

-----

## Instalación

Clarito se instala directamente desde el navegador, sin tienda de aplicaciones.

**En iPhone / iPad:**

1. Abre Safari y ve a la URL de la app
1. Pulsa el botón de compartir
1. Selecciona “Añadir a pantalla de inicio”

**En Android:**

1. Abre Chrome y ve a la URL de la app
1. Pulsa el menú y selecciona “Instalar aplicación”

Una vez instalada, funciona como cualquier otra app del dispositivo.

-----

## Configuración inicial

Al abrir Clarito por primera vez:

- **Usuario nuevo** — introduce tus claves de Google Cloud Vision y Groq, configura los nombres y colores de las personas del hogar
- **Usuario existente** — introduce el Gist ID para recuperar todos tus datos automáticamente, o importa un archivo JSON de exportación

Las claves de API se obtienen de forma gratuita:

- [Google Cloud Console](https://console.cloud.google.com) → Cloud Vision API
- [Groq Console](https://console.groq.com) → API Keys

-----

## Lo que no es

Clarito no es una app de presupuestos. No te pide que categorices cada gasto ni que estimes cuánto vas a gastar el mes que viene. No tiene gráficas de tendencias de cinco años ni objetivos de ahorro.

Es una app para dos personas que compran en el supermercado y quieren saber, sin esfuerzo, cómo van las cuentas.

-----

*Clarito — datos guardados localmente*
