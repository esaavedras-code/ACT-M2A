# Implementación de Control de Acceso Basado en Roles (RBAC) con Alcance por Proyecto

Se ha implementado el modelo de seguridad solicitado, el cual incorpora 4 niveles de usuario y control de acceso detallado mediante políticas gestionadas tanto en la base de datos (vía Supabase) como en el servidor (API Routes). 

Este documento sirve como guía para desarrolladores y administradores sobre cómo estructurar, consumir y auditar el nuevo sistema.

## Matriz de Roles (Niveles)

1. **Nivel A (SuperAdmin / Administrador de Programa)**: Tiene `role_global = 'A'`. Acceso a todos los proyectos sin necesidad de membresía. 
2. **Nivel B (Administrador de Proyecto)**: Tiene membresía con `role = 'B'` en proyectos específicos. Pueden gestionar el proyecto y ver auditorías locales.
3. **Nivel C (Data Entry)**: Tiene membresía con `role = 'C'`. Puede crear o editar datos solo en proyectos asignados, sin alterar la configuración del proyecto o permisos.
4. **Nivel D (Solo Lectura)**: Tiene membresía con `role = 'D'`. Solo tienen permiso de lectura; pueden crear informes de sus proyectos sin alterar datos fuente.

---

## 1. Back-End y Base de Datos (Migración)

Se ejecutó la migración `rbac_schema_init` que establece las siguientes tablas fundamentales para el RBAC:

- **public.users**: Tabla sincronizada automáticamente vía `Trigger` cada vez que alguien se registra por Supabase Auth (`auth.users`). Contiene el rol global (`A` o `standard`).
- **public.memberships**: Vincula `users` con `projects`. Incluye el `role` ('B', 'C', o 'D'), tokens de invitación, número de usos y fecha de caducidad.
- **public.report_definitions` y `public.report_runs**: Permite que usuarios tipo D creen configuraciones de informe de forma segura, definiendo el alcance según sus membresías.
- **public.audit_logs_rbac**: Registro unificado de toda acción sensible. Recopila actor, proyecto, acción y metadatos JSON.

### Reglas Centralizadas (Next.js Server API)
El archivo `src/lib/auth-server.ts` alberga toda la lógica de validación de permisos en el backend, evitando depender únicamente de restricciones UI o LocalStorage. 

---

## 2. API Endpoints Seguros (Ejemplo Práctico)

Se ha creado un endpoint funcional de prueba que muestra cómo blindar rutas basándonos en roles (ver `src/app/api/projects/[id]/invite/route.ts`). 

### Ejemplos de Llamadas a la API

**POST /api/projects/:id/invite**
Sirve para emitir una nueva invitación o compartir enlace hacia un proyecto. Solo Niveles A o B pueden ejecutarlo:
```http
POST /api/projects/dtpfhwxwodzpitzmrbqr/invite
Authorization: Bearer <TUP_JWT_SUPABASE>
Content-Type: application/json

{
  "email": "nuevo_usuario_c@ejemplo.com",
  "role": "C",
  "expires_at": "2026-12-31T23:59:59Z",
  "message": "Te invito a colaborar como Data Entry"
}
```

*Nota para el desarrollador: Cuando vayas a migrar endpoints existentes (como la creación de CHO, o certificaciones), debes usar siempre `await canWriteData(user, projectId)` validando con `auth-server.ts`.*

---

## 3. Guía de Auditoría

El sistema registra las acciones importantes en la tabla `audit_logs_rbac`. La tabla `audit_log` previa seguirá existiendo para triggers retrocompatibles, pero las acciones directas de control de usuarios van aquí.

**Estructura del registro:**
- **actor_user_id**: El usuario que realizó la acción.
- **action**: Constante descriptiva (e.g., `UNAUTHORIZED_INVITE_ATTEMPT`, `INVITE_SENT`, `MEMBERSHIP_REVOKED`).
- **entity**: La tabla afectada (e.g. `memberships`, `projects`, `chos`).
- **entity_id**: El id exacto de la instancia modificada.
- **project_id_nullable**: Si aplica, a qué proyecto pertenecía la acción.
- **timestamp**: Estampa de tiempo exacta (UTC).
- **metadata_json**: Detalles minuciosos. Por ejemplo: permisos rechazados, objeto anterior y nuevo modificado, o nivel concedido.

*Vista de Auditoría UI*: En el Dashboard Global (para A), basta con hacer un `SELECT * FROM audit_logs_rbac ORDER BY timestamp DESC`. B solo podrá realizar `SELECT * FROM audit_logs_rbac WHERE project_id_nullable IN (sus_proyectos)`.

---

## 4. Pruebas y Criterios de Aceptación Cumplidos

Se creó el archivo `src/__tests__/authorization.test.ts` con pruebas unitarias para el servidor:

✅ **TC01**: C intenta POST en proyecto no asignado -> Retorna excepción / `false` de acceso a escritura. (Cubierto en `canWriteData` tests).
✅ **TC02**: D intenta escribir -> `false` al validar, `true` al acceder como lectura. 
✅ **Invitaciones B**: B solo gestiona C o D (el API route verifica la inserción del rol limitándolo).
✅ **Revocación inmediata**: Al settear `revoked_at`, instantáneamente la función `getMembership()` invalida el acceso del usuario para cualquier servidor posterior.

---

## Siguientes Pasos (Para el equipo de Frontend)

1. Para usar este nuevo sistema real, deben migrarse las partes de Next.js que operan sobre `localStorage.getItem("pact_registration")` hacia el cliente SSR o App Router usando el token de sesión de Supabase (`@supabase/ssr` recomendado).
2. Se ha creado el componente `ProjectMemberships` en `src/components/ProjectMemberships.tsx`. Se recomienda insertarlo en la vista de Detalles de Proyecto o Configuración para que el usuario "B" pueda comenzar de inmediato a mandar invitaciones.
3. Para el endpoint de Informes Dinámicos de D: Usar `getReportScope(user)` y enviar esos IDs generados al filtro SQL en Supabase Server Action.
