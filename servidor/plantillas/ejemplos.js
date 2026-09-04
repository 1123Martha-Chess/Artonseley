// ejemplos.js
// -------------------------------------------------------------------
// Plantillas de EJEMPLO que se siembran la primera vez que se crea la
// tabla "plantillas" (ver servidor/db/conexion.js). Son ESQUELETOS de
// muestra, cortos y claramente marcados: sirven para ver cómo funciona
// el generador, NO para usarse ante una autoridad. La biblioteca real la
// carga el administrador (o el abogado responsable de la marca) desde el
// panel, con texto ya validado.
//
// El primer renglón de cada cuerpo es la advertencia; el resto usa
// marcadores {{clave}} / {{clave.subclave}} que el motor detecta solo
// para armar el formulario de captura.
// -------------------------------------------------------------------

export const PLANTILLAS_EJEMPLO = [
  {
    categoria: 'Contratos',
    titulo: 'Contrato de prestación de servicios (EJEMPLO)',
    cuerpo: [
      '⚠️ EJEMPLO — plantilla de muestra. NO usar con clientes reales ni ante autoridad. Sustitúyela por una validada por un abogado.',
      '',
      'CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES',
      '',
      'En {{ciudad}}, a {{fecha}}, celebran este contrato {{prestador.nombre}} ("el Prestador") y {{cliente.nombre}} ("el Cliente"), este último con domicilio en {{cliente.domicilio}} y RFC {{cliente.rfc}}.',
      '',
      'PRIMERA. El Prestador se obliga a lo siguiente: {{servicio.descripcion}}.',
      '',
      'SEGUNDA. El Cliente pagará por los servicios la cantidad de $ {{honorarios.monto}} ({{honorarios.letra}}).',
      '',
      'TERCERA. La vigencia del contrato corre del {{vigencia.inicio}} al {{vigencia.fin}}.',
      '',
      'Firman de conformidad:',
      '',
      '_____________________          _____________________',
      '{{prestador.nombre}}            {{cliente.nombre}}'
    ].join('\n')
  },
  {
    categoria: 'Demandas',
    titulo: 'Escrito inicial de demanda (EJEMPLO)',
    cuerpo: [
      '⚠️ EJEMPLO — plantilla de muestra. NO usar ante autoridad. Sustitúyela por una validada por un abogado.',
      '',
      'C. JUEZ {{juzgado.nombre}}',
      'P R E S E N T E.',
      '',
      '{{actor.nombre}}, por mi propio derecho, señalando como domicilio para oír y recibir notificaciones el ubicado en {{actor.domicilio}}, ante usted respetuosamente comparezco y expongo:',
      '',
      'Que por medio del presente escrito vengo a demandar de {{demandado.nombre}}, con domicilio en {{demandado.domicilio}}, las siguientes',
      '',
      'P R E S T A C I O N E S',
      '',
      'a) {{prestacion.principal}}',
      'b) El pago de gastos y costas del juicio.',
      '',
      'H E C H O S',
      '',
      '1. {{hecho.uno}}',
      '2. {{hecho.dos}}',
      '',
      'D E R E C H O',
      '',
      'Son aplicables los artículos {{fundamento.articulos}}.',
      '',
      'Por lo expuesto, a usted C. Juez pido:',
      '',
      'ÚNICO. Tenerme por presentado en los términos de este escrito.',
      '',
      '{{ciudad}}, a {{fecha}}.',
      'PROTESTO LO NECESARIO',
      '',
      '_____________________',
      '{{actor.nombre}}'
    ].join('\n')
  },
  {
    categoria: 'Escritos varios',
    titulo: 'Recibo de honorarios (EJEMPLO)',
    cuerpo: [
      '⚠️ EJEMPLO — plantilla de muestra. NO es un comprobante fiscal.',
      '',
      'RECIBO DE HONORARIOS',
      '',
      'Recibí de {{cliente.nombre}} la cantidad de $ {{monto}} ({{monto.letra}}) por concepto de {{concepto}}, correspondiente al expediente {{expediente.numero}}.',
      '',
      '{{ciudad}}, a {{fecha}}.',
      '',
      '_____________________',
      '{{abogado.nombre}}'
    ].join('\n')
  }
];
