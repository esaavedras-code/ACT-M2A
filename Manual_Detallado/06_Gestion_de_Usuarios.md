# Sección 06: Gestión de Usuarios y Seguridad
## Administración de Accesos (Solo Admins)
Este módulo es exclusivo para usuarios con rol de **Administrador** y permite gestionar quién tiene acceso al sistema y bajo qué permisos.

### Funcionalidades de Administración:

1.  **Creación de Usuarios:**
    *   **Email y Contraseña Temporal:** Permite invitar a nuevos integrantes al equipo.
    *   **Rol (Role):** Define los permisos (Administrator, Resident Engineer, Supervisor, Observer).
    *   **Estatus:** Permite activar o desactivar una cuenta (ideal al finalizar un proyecto).

2.  **Monitoreo de Presencia (Real-time):**
    *   **Actividad en Tiempo Real:** El sistema muestra quién está en línea.
    *   **Plataformas Usadas:** Identifica si el usuario ingresó desde la versión Web o Desktop (Windows .exe).
    *   **Última Actividad:** Registro de fecha y hora para auditoría.

3.  **Gestión de Roles (RBAC):**
    *   Soporte de permisos específicos por vista.
    *   Seguridad e integridad de datos reforzada por políticas de RLS de Supabase.

### Cómo Usarlo:
- Acceda desde el icono de usuario o escudo en el menú lateral.
- Solo verá esta opción si su cuenta tiene el rol de administrador.
- Use la lista para gestionar ediciones o bajas de personal.

---
### Notas de Seguridad:
- El sistema utiliza **Supabase Auth** para el cifrado de contraseñas.
- Los reportes de auditoría internos pueden rastrear cambios críticos en las bases de datos si se requiere investigar una inconsistencia.

---
> [!IMPORTANT]
> Se recomienda cambiar la contraseña temporal tan pronto como el usuario reciba el acceso inicial.
