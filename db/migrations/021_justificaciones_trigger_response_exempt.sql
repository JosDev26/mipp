-- Limit justificaciones business-window validation to INSERT or when changing date fields
-- This prevents admin responses (estado/comentario) from being blocked by the window.

-- Drop existing trigger that runs on any UPDATE
DROP TRIGGER IF EXISTS trg_justificaciones_validate ON public.justificaciones;

-- Recreate trigger to run only on INSERT or when fecha_inicio/fecha_fin/es_rango are updated
CREATE TRIGGER trg_justificaciones_validate
BEFORE INSERT OR UPDATE OF fecha_inicio, fecha_fin, es_rango ON public.justificaciones
FOR EACH ROW
EXECUTE FUNCTION public.justificaciones_validate_business_window();
