# Demo de Alex: un año ficticio (2026)

La demo pública se abre con **Alex**, una persona inventada, en un espacio
**Individual**. Es una **historia ficticia completa** del 1 de enero al 31 de
diciembre de 2026. Ninguna cifra procede de personas reales y no hay datos de
Juan ni de Kamila (una prueba lo comprueba).

- **Registros:** `src/data/fixtures/demoAlex.ts`. Todas las cifras de todas
  las pantallas se calculan a partir de ellos; ninguna se escribe a mano.
- **Fecha de la demo:** **31-12-2026** (`ALEX_DEMO_TODAY`). Todo lo recibido o
  pagado tiene esa fecha o una anterior; nada futuro aparece como recibido. El
  espacio propio sigue usando la fecha real del dispositivo.
- **Editable y reproducible:** todo se puede cambiar (meses, facturas, gastos,
  transferencias, metas, saldos). La demo no se guarda nunca: **Reset Demo**
  devuelve el año completo y **Exit Demo** descarta los cambios. Se abre desde
  la bienvenida o desde Settings del espacio propio, sin tocarlo. Crear la demo
  dos veces da exactamente los mismos datos (prueba "is the same every time").
- **Pruebas:** `src/domain/finance/alexDemo.test.ts` (cifras, conciliación,
  criterios 1–10, 13 y 14) y `src/AlexDemo.test.tsx` (lo mismo visto en
  pantalla).

## 1. Perfil

| | |
| --- | --- |
| Persona | Alex, ilustrador/a y diseñador/a gráfico/a en Cracovia (inventado). |
| Enero–junio | Último curso de un máster de diseño. Trabajo a media jornada (3.400 netos el día 4), beca (800 el día 15) y encargos freelance sueltos. Habitación en piso compartido (1.650 el día 5). |
| Julio–agosto | Termina el máster y el trabajo a media jornada. Solo ingresos freelance. |
| Desde septiembre | Empleo a jornada completa desde el 7-9 (6.500 netos; el primero, 5.610 por el mes parcial, el 28-9). Estudio propio (2.600, se paga el día 29). |
| Cuentas | Everyday Account (cuenta diaria), Savings Account y Piggy Bank (ahorro), Investment Account. |
| Deudas | Credit Card (18,50 %, corte el 20, pago el 22), Small Loan (9,90 %, nov 2025 – oct 2027, cuota 276,60), Student Loan (2,00 %, cuota 250, hasta abril 2030). |
| Metas | Emergency Fund (sin objetivo al empezar: el borrador de la app lo propone), Trip to Japan (10.000, flexible), New Bike (desde abril, **sin objetivo**), Christmas Gifts (oct–dic, archivada tras usarla). |

## 2. Acontecimientos del año

| Mes | Qué pasa |
| --- | --- |
| Enero | Mes normal con margen. Ahorra 300 (200 al fondo, 100 a Japón). |
| Febrero | Reparación de la pantalla del portátil (1.350, **con tarjeta**, gasto excepcional) → pequeño déficit, que se cubre con la tarjeta. |
| Marzo–abril | Margen positivo. En abril crea la meta New Bike sin objetivo. |
| Mayo | **Devolución del IRPF de 2025: 1.138, marcada como ingreso extraordinario.** Guarda 900 de ella. Paga la mayor parte de la tarjeta. Impresión de la tesis (excepcional). |
| Junio | Alquiler de la toga de graduación. Tarjeta a 0. |
| Julio | Sin sueldo: solo 900 de freelance. **Urgencia dental (780, con tarjeta).** Pausa el gimnasio (julio–septiembre) y el abono de transporte (julio–agosto). Déficit de 2.564,92. |
| Agosto | Solo 650 de freelance. Mudanza (furgoneta 380) y muebles básicos (640, con tarjeta). Utilities pagada **con retraso** (27-8; vencía el 12). Cancela Design Software desde septiembre. Déficit de 3.037,86. |
| Septiembre | Empieza el empleo; primer sueldo el 28. Estudio a 2.600. Último traspaso desde Savings. Cuota del Student Loan pagada **3 días tarde**. **Revisión de suscripciones:** Video Streaming cancelada (último cargo el 9-9) y Music en plan básico desde octubre (23,99 → 16,99). |
| Octubre–noviembre | Recuperación: sueldo completo, la tarjeta baja, vuelve a ahorrar y reconstruye el fondo. Crea Christmas Gifts. |
| Diciembre | Usa los 450 de Christmas Gifts en regalos (traspaso desde Savings + gastos). Liquida la tarjeta (2.489,27). Phone & Internet vence el 31-12 y **sigue pendiente** (Left to Pay 69,99). |

## 3. Supuestos

- **Importes netos.** Todo ingreso es lo recibido en la cuenta; no se mezcla
  bruto y neto.
- **Ingresos recibidos el día de cobro** indicado; noviembre y diciembre se
  cobran antes por fin de semana y vacaciones (nota en el registro).
- **Intereses de préstamos:** cada cuota pagada guarda el interés que "mostró
  el prestamista", calculado como saldo pendiente × tipo anual ÷ 12 y
  redondeado al grosz. Solo el interés es gasto; el resto (principal) baja el
  préstamo. La app **nunca** deduce principal a partir de una cuota completa: si
  falta el interés, ese mes del préstamo no se puede conciliar y lo dice.
- **Intereses de la tarjeta:** se registran como gasto "Interest & Fees" en la
  fecha del extracto (el 20), sobre el saldo pendiente.
- **Pago mínimo de la tarjeta:** el dato guardado (75) es el del último
  extracto. En julio y agosto Alex pagó 60, que era el mínimo de esos
  extractos (supuesto; la app no calcula mínimos).
- **Facturas anuales:** Home Contents Insurance (189, enero) y Cloud Storage
  (99,99, marzo) se pagan una vez al año; el fondo de emergencia las prorratea
  ÷ 12.
- **Saldos:** Alex anotó el saldo de cada cuenta y deuda el 31-12-2025 y al final
  de cada mes. Piggy Bank e Investment Account solo tienen saldo inicial y de
  diciembre (no se anotaron cada mes), así que esos meses aparecen como "sin
  saldo" en la conciliación, sin inventarlo.
- **Gastos diarios** (alimentación, transporte, ocio, salud, comidas fuera,
  compras, regalos…) son registros individuales con fecha, categoría, cuenta y
  naturaleza (habitual, anual o excepcional). Hay 401 registros en History.

## 4. Valores iniciales (31-12-2025)

| Cuenta o deuda | Saldo |
| --- | ---: |
| Everyday Account | 2.150,00 |
| Savings Account | 3.050,00 |
| Piggy Bank | 150,00 |
| Investment Account | 500,00 |
| Credit Card | 1.200,00 |
| Small Loan | 5.543,93 |
| Student Loan | 12.400,00 |

Savings al empezar = 3.200 (3.050 + 150) = Emergency Fund 1.800 + Japón 750 +
650 sin asignar.

## 5. Resumen mensual (PLN)

**Resultado = ingresos recibidos − gasto.** Gasto = facturas pagadas que no son
deuda + gastos (las compras con tarjeta cuentan al comprar) + intereses de
préstamos. Ahorro = Savings Account + Piggy Bank al final del mes.

| Mes | Ingresos | Gasto | Resultado | Everyday | Ahorro | Tarjeta | Small Loan | Student Loan | Deuda total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ene | 4 650,00 | 3 765,93 | 884,07 | 1 992,38 | 3 500,00 | 918,50 | 5 313,07 | 12 170,67 | 18 402,24 |
| feb | 4 200,00 | 4 560,15 | -360,15 | 2 054,71 | 3 700,00 | 2 003,47 | 5 080,30 | 11 940,95 | 19 024,72 |
| mar | 4 900,00 | 3 524,01 | 1 375,99 | 2 196,80 | 4 050,00 | 1 584,36 | 4 845,61 | 11 710,85 | 18 140,82 |
| abr | 4 500,00 | 3 540,43 | 959,57 | 2 216,53 | 4 350,00 | 1 411,62 | 4 608,99 | 11 480,37 | 17 500,98 |
| may | 5 338,00 | 3 391,28 | 1 946,72 | 1 615,56 | 5 250,00 | 233,38 | 4 370,41 | 11 249,50 | 15 853,29 |
| jun | 4 700,00 | 3 425,03 | 1 274,97 | 1 935,36 | 5 500,00 | 0,00 | 4 129,87 | 11 018,25 | 15 148,12 |
| jul | 900,00 | 3 464,92 | -2 564,92 | 1 374,49 | 4 000,00 | 978,22 | 3 887,34 | 10 786,61 | 15 652,17 |
| ago | 650,00 | 3 687,86 | -3 037,86 | 213,92 | 2 500,00 | 1 832,06 | 3 642,81 | 10 554,59 | 16 029,46 |
| sep | 5 610,00 | 4 363,62 | 1 246,38 | 2 819,35 | 1 700,00 | 2 870,07 | 3 396,26 | 10 322,18 | 16 588,51 |
| oct | 6 850,00 | 4 888,60 | 1 961,40 | 3 707,63 | 2 000,00 | 2 578,33 | 3 147,68 | 10 089,38 | 15 815,39 |
| nov | 6 500,00 | 5 071,96 | 1 428,04 | 3 890,61 | 2 450,00 | 2 267,08 | 2 897,05 | 9 856,20 | 15 020,33 |
| dic | 7 200,00 | 5 097,35 | 2 102,65 | 2 789,91 | 2 900,00 | 0,00 | 2 644,35 | 9 622,63 | 12 266,98 |

**Año:** ingresos 55.998,00 (incluye 1.138 extraordinarios), gasto 48.781,14,
resultado **7.216,86**. Meses con déficit: febrero, julio y agosto.

Metas al final de diciembre: Emergency Fund 900, Trip to Japan 1.800, New Bike
200 → 2.900 = todo Savings (0 sin asignar). Diciembre: Planned Bills 6.401,84,
Left to Pay 69,99, Total Debt 12.266,98.

## 6. Cómo se financian los meses con déficit

La identidad que comprueba la app (`monthFunding`, `domain/finance/flows.ts`):

```
resultado = cambio en Everyday + cambio en Savings + cambio en inversiones − cambio en deuda
```

y la parte sin explicar debe ser **0**. Así se ve en Home → This Month → "How is
this worked out?".

| Mes | Déficit | De Savings | De la cuenta Everyday | Deuda nueva (tarjeta, neta de amortizaciones) |
| --- | ---: | ---: | ---: | ---: |
| Febrero | 360,15 | −200 (ahorró igualmente) | −62,33 (subió) | 622,48 |
| Julio | 2.564,92 | 1.500,00 | 560,87 | 504,05 |
| Agosto | 3.037,86 | 1.500,00 | 1.160,57 | 377,29 |

En febrero el déficit lo cubre la tarjeta (la reparación se pagó con ella). En
julio y agosto lo cubren dos traspasos de 1.500 desde Savings (anotados como
retiradas del Emergency Fund: 1.500 y 1.200 + 300 sin asignar), el saldo de la
cuenta diaria y la tarjeta. En septiembre un último traspaso de 800 (450 del
fondo + 350 sin asignar) cubre el mes hasta el primer sueldo. Ningún déficit
se cubre con dinero que aparece sin registro.

## 7. Comprobaciones (automáticas)

- Los 12 meses y el año coinciden con esta tabla (`alexDemo.test.ts`, criterio 1).
- Cada déficit tiene financiación con "sin explicar" = 0 (criterio 2).
- **Conciliación:** para cada cuenta y deuda, saldo inicial + flujos del mes =
  saldo anotado al final del mes, al grosz (criterio 3).
- Facturas, pagos, compras con tarjeta y transferencias no duplican gasto
  (criterio 5); Savings = metas + sin asignar (criterio 6).
- Editar un mes no cambia otros; 5 semillas × 60 ediciones aleatorias mantienen
  los invariantes.

## 8. Qué cambió respecto a la demo anterior

| Antes (demo de octubre, 23-10-2026) | Ahora | Por qué |
| --- | --- | --- |
| Solo octubre y noviembre; 6.500 de ingreso y 4.000 de alquiler fijos | Un año completo con estudios, verano sin sueldo y empleo nuevo | Juan autorizó revisar los valores para tener meses distintos, déficits y recuperación. |
| Facturas marcadas como pagadas, sin gasto diario | Gastos con fecha, categoría, cuenta y naturaleza; transferencias entre cuentas | Para responder "¿en qué uso mi dinero?" sin estimar. |
| La cuota del préstamo no separaba interés | Cada cuota guarda su interés; solo el interés es gasto | No inventar reducciones de principal. |
| Total Debt 17.400 | 12.266,98 a 31-12 | Es el resultado de los registros del año. |
| Emergency Fund con 300 | Fondo que se usa en verano y se reconstruye | Muestra para qué sirve el fondo. |
| Goal Planner con "comfortable contribution" | Explore dentro de cada meta, sin aportación obligatoria | Ver `FINANCIAL_RULES.md`. |

El hogar Duo de pruebas (`demoHousehold.ts`, fecha 23-10-2026) no cambia y
solo lo usan las pruebas.
