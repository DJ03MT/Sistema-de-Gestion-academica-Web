 // --- LÓGICA DE ASISTENCIA (Botones) ---
    document.querySelectorAll('.attendance-buttons').forEach(container => {
      container.addEventListener('click', function(e) {
        const clickedButton = e.target.closest('.btn-attendance');
        if (!clickedButton) return;
        container.querySelectorAll('.btn-attendance').forEach(btn => {
           btn.classList.remove('active');
        });
        clickedButton.classList.add('active');
      });
    });

    // --- LÓGICA PARA GUARDAR ASISTENCIA ---
    (function() {
      const guardarAsistenciaBtn = document.getElementById('guardarAsistenciaBtn');
      if (!guardarAsistenciaBtn) return;
      guardarAsistenciaBtn.addEventListener('click', function() {
        const fechaEl = document.getElementById('fecha-asistencia');
        const fecha = fechaEl ? fechaEl.value : null;
        let asistencias = [];
        document.querySelectorAll('.acordeon-content.open .btn-attendance.active').forEach(btn => {
          asistencias.push({
            id: btn.dataset.id,
            status: btn.dataset.status
          });
        });
        if (asistencias.length === 0) {
          alert('No has marcado la asistencia de ningún estudiante en los cursos que tienes abiertos.');
          return;
        }
        
        async function guardarAsistenciaFetch(fecha, asistencias) {
            try {
                // NOTA: Debes crear esta ruta en 'profesor.routes.js' y su controlador
                console.log('Intentando guardar asistencia:', { fecha, asistencias });
                const response = await fetch('/profesores/guardar-asistencia', { 
                  method: 'POST',
                  credentials: 'same-origin', // Enviar cookies de sesión
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                  body: JSON.stringify({ fecha: fecha, asistencias: asistencias })
                });
                console.log('Respuesta recibida del servidor para guardar asistencia.');
                console.log(response);
                if (!response.ok) {
                  // Intentar parsear JSON con mensaje de error si existe
                  let errText = await response.text();
                  try { errText = JSON.parse(errText).message || errText; } catch(e) {}
                  throw new Error(`HTTP ${response.status}: ${errText}`);
                }
                const data = await response.json();
                console.log('Datos parseados de la respuesta:', data);
                if (data.success) {
                    alert('Asistencia guardada con éxito.');
                } else {
                    throw new Error(data.message || 'Error desconocido');
                }
            } catch (err) {
                console.error('Error al guardar la asistencia:', err);
                alert(`Error al guardar: ${err.message}. (Función no implementada en el backend)`);
            }
        }
        
        // Se llama a la función, pero fallará si la ruta no existe
        guardarAsistenciaFetch(fecha, asistencias);

      });
    })();
    
    // --- (Funciones fetch de guardado individual - SIN CAMBIOS) ---
    // ...

    // --- LÓGICA DE CRITERIOS CUALITATIVOS (SIN CAMBIOS) ---
    function getNotaCualitativa(nota) {
      const notaRedondeada = Math.round(nota);
      if (notaRedondeada >= 90) return 'Excelente (AA)';
      if (notaRedondeada >= 80) return 'Muy Bueno (AS)';
      if (notaRedondeada >= 70) return 'Bueno (AE)';
      if (notaRedondeada >= 60) return 'Regular (AM)';
      return 'Insuficiente (AI)';
    }

    // --- ============================================ ---
    // --- NUEVA FUNCIÓN: OBTENER LETRA DE VALORES      ---
    // --- ============================================ ---
    function getLetraCualitativa(nota) {
        // Usamos los rangos de la tabla de disciplinas [cite: 566] y los
        // aplicamos a las letras de la tabla de actitudes [cite: 579]
        const n = parseFloat(nota);
        if (n >= 90) return 'E';  // Excelente (Equivalente a AA)
        if (n >= 80) return 'MB'; // Muy Bueno (Equivalente a AS)
        if (n >= 70) return 'B';  // Bueno (Equivalente a AE)
        if (n >= 60) return 'R';  // Regular (Equivalente a AM)
        if (n >= 0) return 'I';   // Insuficiente (Equivalente a AI)
        return '--'; // Si está vacío
    }

    // --- ✅ Lógica de Cálculo de Fila (ACTUALIZADA) ---
    function calcularFila(row) {
      const numCriterios = 4;
      let sumaCortes = 0;
      let cortesCompletados = 0;
      
      let c1 = 0, c2 = 0, c3 = 0, c4 = 0;
      let v1 = 0, v2 = 0, v3 = 0, v4 = 0;
 
      // --- Obtener elementos ---
      const c1El = row.querySelector(`[data-calc="c1"]`);
      const c2El = row.querySelector(`[data-calc="c2"]`);
      const c3El = row.querySelector(`[data-calc="c3"]`);
      const c4El = row.querySelector(`[data-calc="c4"]`);

      const v1El = row.querySelector(`[data-calc="v1"]`);
      const v2El = row.querySelector(`[data-calc="v2"]`);
      const v3El = row.querySelector(`[data-calc="v3"]`);
      const v4El = row.querySelector(`[data-calc="v4"]`);

      // --- Obtener valores y contar ---
      if (c1El && c1El.value) { c1 = parseFloat(c1El.value) ||
 0; if(c1 > 0 || c1El.value === '0') { sumaCortes += c1; cortesCompletados++;
 } }
      if (c2El && c2El.value) { c2 = parseFloat(c2El.value) || 0;
 if(c2 > 0 || c2El.value === '0') { sumaCortes += c2; cortesCompletados++;
 } }
      if (c3El && c3El.value) { c3 = parseFloat(c3El.value) || 0;
 if(c3 > 0 || c3El.value === '0') { sumaCortes += c3; cortesCompletados++;
 } }
      if (c4El && c4El.value) { c4 = parseFloat(c4El.value) || 0;
 if(c4 > 0 || c4El.value === '0') { sumaCortes += c4; cortesCompletados++;
 } }
      
      // Obtener valores de Valores
      if (v1El && v1El.value) { v1 = parseFloat(v1El.value) || 0; }
      if (v2El && v2El.value) { v2 = parseFloat(v2El.value) || 0; }
      if (v3El && v3El.value) { v3 = parseFloat(v3El.value) || 0; }
      if (v4El && v4El.value) { v4 = parseFloat(v4El.value) || 0; }

      // --- ============================================ ---
      // --- CAMBIO: Actualizar las letras de Valores     ---
      // --- ============================================ ---
      const v1LetraEl = row.querySelector(`[data-calc="v1-letra"]`);
      const v2LetraEl = row.querySelector(`[data-calc="v2-letra"]`);
      const v3LetraEl = row.querySelector(`[data-calc="v3-letra"]`);
      const v4LetraEl = row.querySelector(`[data-calc="v4-letra"]`);

      if(v1LetraEl) v1LetraEl.textContent = getLetraCualitativa(v1El.value);
      if(v2LetraEl) v2LetraEl.textContent = getLetraCualitativa(v2El.value);
      if(v3LetraEl) v3LetraEl.textContent = getLetraCualitativa(v3El.value);
      if(v4LetraEl) v4LetraEl.textContent = getLetraCualitativa(v4El.value);
      // --- ============================================ ---
      // --- FIN DEL CAMBIO                               ---
      // --- ============================================ ---

      // --- Calculamos promedios ---
      const sem1 = (c1El && c1El.value && c2El && c2El.value) ?
 (c1 + c2) / 2 : (c1 + c2);
      const sem2 = (c3El && c3El.value && c4El && c4El.value) ?
 (c3 + c4) / 2 : (c3 + c4);

      const vfCuantitativo = (cortesCompletados > 0) ?
 (sumaCortes / cortesCompletados) : 0;
      const vfFinalRedondeado = Math.round(vfCuantitativo);
      const vfCualitativo = getNotaCualitativa(vfCuantitativo);
      
      const rowData = {
          sem1: sem1,
          sem2: sem2,
          finalCuanti: vfCuantitativo,
          finalCuali: vfCualitativo,
          Nota_Corte1: (c1El && c1El.value) ? c1 : null,
          Nota_Corte2: (c2El && c2El.value) ? c2 : null,
          Nota_Corte3: (c3El && c3El.value) ? c3 : null,
          Nota_Corte4: (c4El && c4El.value) ? c4 : null,
          Nota_Valores_C1: (v1El && v1El.value) ? v1 : null,
          Nota_Valores_C2: (v2El && v2El.value) ? v2 : null,
          Nota_Valores_C3: (v3El && v3El.value) ? v3 : null,
          Nota_Valores_C4: (v4El && v4El.value) ? v4 : null
      };
      row.dataset.calculated = JSON.stringify(rowData);
      
      row.querySelector(`[data-calc="vf-cuanti"]`).textContent = vfFinalRedondeado;
      row.querySelector(`[data-calc="vf-cuali"]`).textContent = vfCualitativo;
     }
      
    // --- NAVEGACIÓN Y OTROS SCRIPTS (MODIFICADOS) ---
    document.addEventListener('DOMContentLoaded', function() {

      // --- Script para Filtro de Columnas (SIN CAMBIOS) ---
      document.querySelectorAll('.corte-filters').forEach(container => {
        container.addEventListener('click', function(e) {
          const btn = e.target.closest('.corte-filter-btn');
          if (!btn) return;
          const tableId = btn.dataset.tableId;
          const filter = btn.dataset.filter;
          const table = document.getElementById(tableId);
          if (!table) return;
          container.querySelectorAll('.corte-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          table.classList.remove('show-c1', 'show-c2', 'show-c3', 'show-c4', 'show-final', 'show-all');
          if (filter === 'all') {
            table.classList.add('show-all');
          } else {
            table.classList.add(`show-${filter}`);
          }
        });
      });

      // --- Navegación de Pestañas (Sidebar) (SIN CAMBIOS) ---
      const navLinks = document.querySelectorAll('.nav-link');
      const contentSections = document.querySelectorAll('.content-section');
      navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          navLinks.forEach(item => item.classList.remove('active'));
           this.classList.add('active');
          const sectionId = this.getAttribute('data-section');
          contentSections.forEach(section => section.classList.remove('active'));
          document.getElementById(sectionId).classList.add('active');
        });
      });

      // --- Fecha Actual (SIN CAMBIOS) ---
      const currentDateElement = document.getElementById('currentDate');
      if (currentDateElement) { 
        const now = new Date();
        const options = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        };
        currentDateElement.textContent = now.toLocaleDateString('es-ES', options);
      }

      // --- Lógica del Acordeón (SIN CAMBIOS) ---
      const acordeones = document.querySelectorAll('.acordeon-header');
      acordeones.forEach(header => {
        header.addEventListener('click', function() {
          const targetId = this.getAttribute('data-target');
          const content = document.getElementById(targetId);
          this.classList.toggle('active');
          if (content.style.maxHeight) {
            content.style.maxHeight = null;
            content.classList.remove('open');
          } else {
            content.classList.add('open');
            const maxHeight = Math.min(content.scrollHeight + 80, window.innerHeight * 0.60);
            content.style.maxHeight = maxHeight + "px";
          }
        });
      });

      // --- ============================================ ---
      // --- CAMBIO: Validación de inputs numéricos       ---
      // --- ============================================ ---
      // (Ahora valida 'nota-valores-input' por separado)
      document.querySelectorAll('.nota-excel-input, .conducta-input, .nota-valores-input').forEach(input => {
        input.addEventListener('input', function() {
          let val = this.value;
          // Permitir decimales solo para notas de corte
          if (this.classList.contains('nota-excel-input')) {
            val = val.replace(/[^0-9.]/g, '');
            if ((val.match(/\./g) || []).length > 1) {
              val = val.substring(0, val.lastIndexOf('.'));
            }
          } else {
            // Para Valores y Conducta, solo enteros
            val = val.replace(/[^0-9]/g, '');
          }
          
          if (parseFloat(val) > 100) val = '100';
          this.value = val;
        });
        
        input.addEventListener('blur', function() {
          if (this.value === '') return;
          let val = parseFloat(this.value) || 0;
          if (val > 100) val = 100;
          if (val < 0) val = 0;
          
          if (this.classList.contains('nota-excel-input')) {
             this.value = val; // Permitir decimales
          } else {
             this.value = Math.round(val); // Forzar entero
          }
        });
      });
      
      // --- Lógica para Guardar Notas en Bloque (SIN CAMBIOS) ---
      document.querySelectorAll('.guardar-notas-btn').forEach(button => {
        button.addEventListener('click', async function() {
          const formId = this.getAttribute('data-form-id');
          const statusId = this.getAttribute('data-status-id');
          const form = document.getElementById(formId);
          const statusMsg = document.getElementById(statusId);
          if (!form) return;
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
          statusMsg.style.display = 'none';
          const datosLibreta = [];
          const rows = form.querySelectorAll('tbody tr[data-row-id]');

          rows.forEach(row => {
            const inscripcionId = row.dataset.rowId;
            // ¡Importante! El cálculo se hace ANTES de guardar
            // así que row.dataset.calculated ya tiene los números correctos
            let calculated = JSON.parse(row.dataset.calculated || '{}'); 
            const conductaEl = row.querySelector('[data-parcial="conducta"]');
            const obsEl = row.querySelector('.obs-input');
            const estudianteData = {
                ID_Inscripcion: inscripcionId,
                Conducta: conductaEl ? (conductaEl.value || null) : null,
                Observacion: obsEl ? (obsEl.value || null) : null,
                Nota_Corte1: calculated.Nota_Corte1 || null,
                Nota_Corte2: calculated.Nota_Corte2 || null,
                Nota_Corte3: calculated.Nota_Corte3 || null,
                Nota_Corte4: calculated.Nota_Corte4 || null,
                Nota_Valores_C1: calculated.Nota_Valores_C1 || null,
                Nota_Valores_C2: calculated.Nota_Valores_C2 || null,
                Nota_Valores_C3: calculated.Nota_Valores_C3 || null,
                Nota_Valores_C4: calculated.Nota_Valores_C4 || null,
                Promedio_Semestral_1: calculated.sem1 || 0,
                Promedio_Semestral_2: calculated.sem2 || 0,
                Promedio_Final_Cuantitativo: calculated.finalCuanti || 0,
                Promedio_Final_Cualitativo: calculated.finalCuali || 'N/A',
            };
            datosLibreta.push(estudianteData);
          });
          
          try {
            const response = await fetch('/profesores/guardar-libreta', {
              method: 'POST',
              credentials: 'same-origin', // Enviar cookies de sesión
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ libreta: datosLibreta })
             });
            if (!response.ok) {
              let errText = await response.text();
              try { errText = JSON.parse(errText).message || errText; } catch(e) {}
              throw new Error(`HTTP ${response.status}: ${errText}`);
            }
            const data = await response.json();
            if (data.success) {
                statusMsg.textContent = '¡Libreta guardada con éxito!';
                statusMsg.className = 'status-message success';
            } else {
                throw new Error(data.message || 'Error desconocido');
             }
          } catch (err) {
            console.error('Error al guardar la libreta:', err);
            statusMsg.textContent = `Error: ${err.message}`;
            statusMsg.className = 'status-message error';
          } finally {
            statusMsg.style.display = 'inline';
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-save"></i> Guardar Todas las Notas';
           }
        });
      });
      
      // --- Lógica para auto-cálculo de notas (SIN CAMBIOS) ---
      document.querySelectorAll('.calc-input').forEach(input => {
        input.addEventListener('input', function() {
          const row = this.closest('tr');
          if (row) calcularFila(row);
        });
        input.addEventListener('change', function() { // <- 'change' para los <select>
          const row = this.closest('tr');
          if (row) calcularFila(row);
        });
      });
      
      // Calcular todas las filas al cargar la página
      document.querySelectorAll('#notas tbody tr').forEach(row => {
        if (row.hasAttribute('data-row-id')) {
          calcularFila(row);
        }
      });
    });