import { TinaNodeBackend, LocalBackendAuthProvider } from "@tinacms/datalayer";
import { databaseClient } from "../../../../tina/__generated__/client";

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

/**
 * Handler principal para todas las rutas de la API de TinaCMS
 * @param {Object} context - El contexto de la solicitud
 * @returns {Promise<Response>} - Una respuesta HTTP
 */
export async function ALL(context) {
  try {
    const handler = TinaNodeBackend({
      authProvider: LocalBackendAuthProvider(),
      databaseClient,
      // Configuración adicional para mejorar el manejo de errores
      errorHandler: (err) => {
        console.error("TinaCMS API Error:", err);
        return new Response(JSON.stringify({ 
          error: true, 
          message: err.message || "Error en la API de TinaCMS" 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });
    
    return await handler(context.request);
  } catch (error) {
    console.error("Error inesperado en la API de TinaCMS:", error);
    return new Response(JSON.stringify({ 
      error: true, 
      message: "Error inesperado en el servidor" 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Rutas estándar para Astro SSR
export async function get(context) {
  return await ALL(context);
}

export async function post(context) {
  return await ALL(context);
}

export async function put(context) {
  return await ALL(context);
}

export async function del(context) {
  return await ALL(context);
} 