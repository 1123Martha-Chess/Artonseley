// La estructura de tu diccionario
/**
 * diccionarioLeyes.js
 * ---------------------------------------------------------------------------
 * Diccionario de sinónimos y términos relacionados para el motor de búsqueda
 * de Artonseley.
 *
 * Estructura: cada clave es un término jurídico "canónico" (el más probable
 * de aparecer redactado en el texto de las leyes) y su valor es un arreglo
 * de sinónimos, variantes coloquiales, tecnicismos equivalentes y términos
 * estrechamente relacionados que un usuario podría escribir en el buscador.
 * Cada entrada tiene al menos 6 sinónimos, para que el buscador reconozca
 * varias formas de preguntar por el mismo concepto y no solo la más obvia.
 *
 * Objetivo: cuando el usuario busca cualquiera de los sinónimos, el motor
 * de búsqueda debe poder mapearlo de vuelta al término canónico (o expandir
 * la búsqueda para incluir también los artículos que usan el sinónimo),
 * mejorando así el recall sin sacrificar precisión.
 *
 * Cobertura: derecho penal, civil, familiar, laboral, mercantil, fiscal,
 * administrativo, constitucional y de amparo, procesal, aguas/ambiental,
 * militar y salud — alineado con los ordenamientos federales mexicanos
 * que integran la plataforma (Código Penal Federal, Código Civil Federal,
 * Ley Federal del Trabajo, Código Fiscal de la Federación, Ley de Amparo,
 * Código de Justicia Militar, Código Federal de Procedimientos Civiles,
 * Ley de Aguas Nacionales, entre otros).
 *
 * Nota de redacción: los arreglos no pretenden ser sinónimos estrictos en
 * sentido lexicográfico puro (RAE), sino un campo semántico de búsqueda:
 * incluyen sinónimos propiamente dichos, cuasisinónimos, tecnicismos
 * equivalentes usados en distintos códigos y expresiones coloquiales con
 * las que un usuario no jurista podría formular la misma consulta.
 * ---------------------------------------------------------------------------
 */

import { formasEquivalentes } from './formasPlurales.js';

export const diccionarioLeyes = {
  "ley": ["norma", "normativa", "disposición legal", "ordenamiento jurídico", "precepto legal", "estatuto", "legislación", "cuerpo normativo"],
  "código": ["cuerpo normativo", "compilación de leyes", "ordenamiento jurídico", "cuerpo legal", "codificación", "conjunto de normas", "compendio legal", "cuerpo de leyes"],
  "reglamento": ["normativa reglamentaria", "disposición reglamentaria", "reglamentación", "ordenamiento administrativo", "norma de aplicación", "instrumento reglamentario"],
  "decreto": ["disposición del Ejecutivo", "mandato", "ordenamiento", "decreto-ley", "acuerdo presidencial", "disposición ejecutiva"],
  "jurisprudencia": ["precedente judicial", "criterio jurisdiccional", "criterio obligatorio", "criterio reiterado", "interpretación judicial obligatoria"],
  "tesis": ["criterio jurisprudencial", "precedente judicial", "publicación de criterio", "criterio aislado", "interpretación jurisdiccional", "resolución que fija criterio"],
  "doctrina": ["teoría jurídica", "opinión de los juristas", "estudio doctrinal", "literatura jurídica", "análisis académico del derecho", "fuente doctrinal"],
  "legislación": ["ordenamiento jurídico", "conjunto de leyes", "normativa vigente", "cuerpo legal", "marco legal", "corpus legal", "cuerpo de disposiciones vigentes"],
  "derecho": ["ordenamiento jurídico", "ciencia jurídica", "facultad legal", "prerrogativa", "potestad jurídica", "sistema jurídico", "conjunto de normas jurídicas"],
  "justicia": ["equidad", "imparcialidad", "administración de justicia", "impartición de justicia", "recta impartición del derecho", "tutela judicial efectiva"],
  "tribunal": ["juzgado", "corte", "sala", "órgano jurisdiccional", "instancia judicial", "autoridad judicial"],
  "juzgado": ["tribunal", "corte", "instancia judicial", "órgano jurisdiccional", "sede judicial", "despacho judicial"],
  "juez": ["juzgador", "titular del juzgado", "autoridad jurisdiccional", "impartidor de justicia", "titular del órgano jurisdiccional"],
  "magistrado": ["juez de segunda instancia", "juzgador colegiado", "juzgador de tribunal colegiado", "integrante de sala", "juzgador de alzada"],
  "ministro": ["magistrado de la Suprema Corte", "integrante del máximo tribunal", "integrante de la Suprema Corte de Justicia de la Nación", "juzgador de más alta jerarquía", "titular de la Corte", "juzgador del máximo tribunal"],
  "ministerio público": ["fiscalía", "representante social", "agente del ministerio público", "órgano acusador", "titular de la acción penal", "representante de la sociedad"],
  "fiscal": ["ministerio público", "representante social", "acusador público", "agente investigador", "titular de la fiscalía", "persecutor del delito"],
  "abogado": ["licenciado en derecho", "litigante", "jurisconsulto", "asesor legal", "letrado", "procurador"],
  "defensor": ["abogado defensor", "asesor jurídico", "representante legal", "defensor de oficio", "defensor público", "abogado patrono", "representante en juicio"],
  "demandante": ["actor", "parte actora", "querellante", "accionante", "promovente", "parte que ejerce la acción"],
  "demandado": ["parte demandada", "reo civil", "enjuiciado", "contraparte", "parte contraria", "sujeto pasivo de la demanda"],
  "acusado": ["imputado", "inculpado", "procesado", "indiciado", "sindicado", "encausado"],
  "imputado": ["acusado", "inculpado", "procesado", "indiciado", "presunto responsable", "sujeto de investigación"],
  "víctima": ["ofendido", "agraviado", "sujeto pasivo del delito", "parte afectada", "damnificado", "persona ofendida"],
  "ofendido": ["víctima", "agraviado", "afectado", "parte lesionada", "víctima del delito", "parte agraviada"],
  "delito": ["ilícito", "infracción penal", "conducta delictiva", "crimen", "hecho punible", "acto delictivo"],
  "crimen": ["delito grave", "ilícito penal", "hecho punible", "conducta antijurídica grave", "hecho criminal", "acto criminal"],
  "falta": ["infracción", "contravención", "incumplimiento leve", "falta administrativa", "conducta sancionable menor", "transgresión leve"],
  "infracción": ["falta", "contravención", "violación normativa", "incumplimiento", "transgresión", "quebrantamiento de la norma"],
  "juicio": ["proceso judicial", "litigio", "procedimiento judicial", "causa", "instancia jurisdiccional"],
  "litigio": ["controversia", "juicio", "conflicto jurídico", "pleito", "disputa legal", "contienda legal"],
  "controversia": ["litigio", "conflicto", "disputa jurídica", "diferendo", "desacuerdo jurídico", "confrontación legal"],
  "jurisdicción": ["potestad jurisdiccional", "ámbito de aplicación de la ley", "esfera de competencia", "potestad de juzgar", "ámbito jurisdiccional"],
  "competencia": ["atribución", "facultad legal", "ámbito de actuación", "esfera de atribuciones", "ámbito competencial"],
  "demanda": ["escrito inicial", "acción judicial", "petición judicial", "libelo", "escrito de demanda", "acción procesal"],
  "sentencia": ["fallo", "resolución judicial", "veredicto", "laudo", "determinación judicial", "decisión final del juzgador"],
  "resolución": ["determinación", "acuerdo judicial", "fallo", "auto", "proveído", "decisión de autoridad"],
  "auto": ["proveído", "acuerdo judicial", "resolución interlocutoria", "determinación procesal", "decreto judicial", "acuerdo de trámite"],
  "apelación": ["recurso de alzada", "impugnación", "segunda instancia", "recurso ordinario", "medio de impugnación ordinario", "alzada"],
  "recurso": ["impugnación", "medio de defensa", "instancia de revisión", "medio de impugnación", "vía de impugnación", "remedio procesal"],
  "amparo directo": ["amparo contra sentencia definitiva", "juicio de garantías directo", "impugnación de sentencia definitiva ante tribunal colegiado", "amparo uniinstancial", "amparo casación"],
  "amparo indirecto": ["amparo biinstancial", "juicio de garantías ante juez de distrito", "amparo contra actos de autoridad", "amparo ante juzgado de distrito", "amparo de doble instancia", "amparo biinstancial ante juez federal"],
  "prueba": ["evidencia", "medio probatorio", "elemento de convicción", "material probatorio", "elemento probatorio", "fuente de convicción"],
  "testigo": ["declarante", "deponente", "atestiguante", "persona que rinde testimonio", "testificante", "compareciente que declara"],
  "perito": ["experto", "especialista técnico", "dictaminador", "profesional dictaminador", "auxiliar técnico del juzgador", "especialista pericial"],
  "notificación": ["aviso procesal", "comunicación procesal", "diligencia de notificación", "acto de comunicación procesal", "aviso judicial"],
  "emplazamiento": ["citación", "llamado a juicio", "notificación de demanda", "notificación para comparecer", "llamamiento judicial", "emplazamiento a juicio"],
  "comparecencia": ["presentación ante autoridad", "asistencia a audiencia", "concurrencia judicial", "presencia ante el juzgador", "acto de comparecer", "asistencia procesal"],
  "audiencia": ["diligencia judicial", "vista", "comparecencia procesal", "vista pública", "sesión judicial", "diligencia procesal"],
  "embargo": ["aseguramiento de bienes", "traba de bienes", "secuestro judicial de bienes", "retención de bienes", "medida de apremio sobre bienes", "afectación cautelar de bienes"],
  "ejecución": ["cumplimiento forzoso", "diligencia de cobro", "vía de apremio", "cobro forzoso", "procedimiento de apremio", "ejecución forzosa de sentencia"],
  "prescripción": ["extinción por el transcurso del tiempo", "pérdida de la acción por el tiempo", "extinción del derecho por el tiempo", "vencimiento del plazo para actuar", "prescripción de la acción"],
  "caducidad": ["extinción por vencimiento de plazo", "pérdida de derecho por inacción", "decaimiento del derecho", "vencimiento de la instancia", "extinción del procedimiento por inactividad", "fenecimiento del plazo"],
  "cosa juzgada": ["autoridad de sentencia firme", "firmeza de lo resuelto", "inmutabilidad del fallo", "sentencia que ya no admite recurso", "carácter definitivo de la sentencia", "cosa juzgada material"],
  "expediente": ["autos", "legajo judicial", "conjunto de actuaciones", "constancias del proceso", "actuaciones judiciales"],
  "carpeta de investigación": ["expediente ministerial", "averiguación previa", "indagatoria", "registro de la investigación", "carpeta ministerial", "expediente de investigación"],
  "denuncia": ["aviso a la autoridad", "delación", "reporte de un delito", "puesta en conocimiento del delito", "noticia criminal"],
  "querella": ["acusación formal", "requisito de procedibilidad", "instancia de parte ofendida", "querella penal", "acusación de parte"],
  "robo": ["hurto", "asalto", "saqueo", "ratería", "atraco", "sustracción", "apoderamiento ilegítimo", "rapiña"],
  "homicidio": ["asesinato", "matar", "quitar la vida", "ejecución", "privación de la vida", "muerte violenta"],
  "feminicidio": ["asesinato de una mujer por razones de género", "muerte violenta de una mujer", "homicidio de mujer por razón de género", "crimen de odio contra la mujer", "asesinato con violencia de género", "privación de la vida de una mujer por su condición de género"],
  "lesiones": ["daño corporal", "heridas", "golpes", "agresión física", "menoscabo a la salud", "menoscabo físico"],
  "secuestro": ["plagio", "privación ilegal de la libertad", "levantón", "cautiverio ilegal", "detención ilegal con fines de rescate"],
  "extorsión": ["chantaje", "amenaza para obtener dinero", "coacción económica", "cobro de piso", "amenaza para exigir dinero o beneficio", "intimidación con fines de lucro"],
  "amenazas": ["intimidación", "coacción", "advertencia de daño", "amago", "anuncio de un mal futuro", "conminación"],
  "fraude": ["engaño", "estafa", "timar", "trampa", "artificio"],
  "estafa": ["fraude", "engaño", "timo", "artimaña", "engaño con fines de lucro", "artificio doloso"],
  "abuso de confianza": ["disposición indebida de bienes", "apropiación indebida", "distracción de bienes", "traición a la confianza depositada", "uso indebido de bienes ajenos", "quebrantamiento de la buena fe contractual"],
  "peculado": ["malversación de fondos públicos", "desvío de recursos públicos", "apropiación de caudales públicos", "sustracción de recursos por servidor público", "robo de fondos del erario", "desfalco de recursos públicos"],
  "malversación": ["peculado", "desvío de fondos", "uso indebido de recursos públicos", "manejo indebido de fondos", "distracción de fondos públicos", "aplicación indebida de recursos"],
  "enriquecimiento ilícito": ["incremento patrimonial injustificado", "enriquecimiento injustificado", "acumulación ilícita de bienes", "acrecentamiento patrimonial sin causa lícita", "patrimonio no justificado de servidor público", "riqueza inexplicable"],
  "cohecho": ["soborno", "dádiva a servidor público", "coima", "compra de voluntad de servidor público", "pago ilícito a funcionario"],
  "soborno": ["cohecho", "coima", "mordida", "dádiva ilícita", "pago para obtener favor indebido", "compensación ilícita a servidor público"],
  "tráfico de influencias": ["uso indebido de influencia", "gestión ilícita ante autoridad", "influyentismo", "aprovechamiento indebido de posición", "uso indebido de contactos oficiales", "abuso de contactos ante autoridad"],
  "abuso de autoridad": ["exceso en el ejercicio del cargo", "extralimitación de funciones", "arbitrariedad de servidor público", "ejercicio ilegítimo del cargo público", "desvío de poder", "abuso de facultades"],
  "lavado de dinero": ["blanqueo de capitales", "operaciones con recursos de procedencia ilícita", "legitimación de capitales", "ocultamiento del origen ilícito de recursos", "lavado de activos", "reciclaje de dinero ilícito"],
  "narcotráfico": ["tráfico de drogas", "comercio de estupefacientes", "delincuencia relacionada con drogas", "distribución ilegal de estupefacientes", "narcomenudeo", "crimen organizado del narcotráfico"],
  "posesión de droga": ["tenencia de estupefacientes", "posesión de narcóticos", "portación de drogas", "resguardo de narcóticos", "posesión simple de droga", "tenencia ilícita de sustancias"],
  "contrabando": ["introducción ilegal de mercancías", "tráfico de mercancías sin pago de impuestos", "comercio ilícito de mercancías", "comercio clandestino de mercancías", "importación ilegal", "evasión aduanera"],
  "defraudación fiscal": ["evasión fiscal", "fraude tributario", "engaño al fisco", "omisión dolosa de contribuciones", "delito fiscal"],
  "evasión fiscal": ["defraudación fiscal", "incumplimiento tributario doloso", "incumplimiento del pago de impuestos", "ocultamiento de ingresos al fisco", "no pago doloso de contribuciones"],
  "trata de personas": ["explotación humana", "esclavitud moderna", "comercio de seres humanos", "explotación laboral o sexual de personas", "reclutamiento con fines de explotación"],
  "violación": ["infracción", "incumplimiento", "quebrantamiento", "contravención", "transgresión", "conculcación", "inobservancia", "ultraje", "acceso carnal violento"],
  "abuso sexual": ["agresión sexual", "tocamientos indebidos", "atentado al pudor", "contacto sexual sin consentimiento", "violencia sexual"],
  "acoso": ["hostigamiento", "persecución insistente", "intimidación reiterada", "asedio", "conducta reiterada de hostigamiento", "molestia insistente no deseada"],
  "hostigamiento": ["acoso", "acecho", "persecución", "asedio reiterado", "presión insistente hacia otra persona", "conducta de hostigamiento reiterado"],
  "violencia familiar": ["violencia doméstica", "maltrato intrafamiliar", "violencia intrafamiliar", "agresión entre integrantes del núcleo familiar", "abuso dentro del hogar", "violencia en el ámbito familiar"],
  "violencia de género": ["violencia contra la mujer", "discriminación violenta por razón de sexo", "agresión motivada por el género", "violencia machista", "violencia por razones de género", "discriminación de género con violencia"],
  "tortura": ["maltrato físico o psicológico", "trato cruel", "vejación", "tormento", "sufrimiento infligido deliberadamente", "trato inhumano y degradante"],
  "desaparición forzada": ["privación ilegal de la libertad por agentes del Estado", "desaparición cometida por particulares con apoyo estatal", "ocultamiento del paradero de una persona por autoridad", "desaparición de persona con participación estatal", "detención no reconocida por el Estado", "sustracción de persona con aquiescencia estatal"],
  "allanamiento de morada": ["violación de domicilio", "ingreso ilegal a vivienda", "invasión de domicilio", "ingreso sin autorización a domicilio", "irrupción en domicilio ajeno", "entrada ilícita a vivienda"],
  "daño en propiedad ajena": ["destrucción de bienes", "menoscabo patrimonial doloso", "daño doloso a bienes", "afectación dolosa a bienes de otro", "deterioro intencional de bienes ajenos", "vandalismo"],
  "despojo": ["desposesión ilegal", "usurpación de inmueble", "arrebato de posesión", "privación ilegítima de la posesión", "desalojo ilegal", "invasión de inmueble"],
  "usurpación": ["despojo", "apropiación indebida de identidad o funciones", "suplantación de funciones", "apropiación de lo ajeno sin derecho", "invasión de atribuciones", "ejercicio indebido de funciones ajenas"],
  "usurpación de identidad": ["suplantación de identidad", "robo de identidad", "hacerse pasar por otra persona", "usurpación de datos personales", "fraude de identidad", "apropiación de identidad ajena"],
  "falsificación": ["adulteración", "alteración documental", "fraude documental", "falsificación de documentos", "elaboración de un documento apócrifo", "confección de documento falso"],
  "falsedad": ["mentira procesal", "declaración falsa", "engaño formal", "afirmación contraria a la verdad", "falsedad en declaraciones", "aseveración falsa ante autoridad"],
  "perjurio": ["falso testimonio", "declaración falsa bajo protesta", "mentir bajo juramento", "testimonio falso ante autoridad", "declaración falsa ante juzgador", "juramento en falso"],
  "encubrimiento": ["complicidad posterior al hecho", "ocultamiento de delito", "favorecimiento", "auxilio posterior al delito", "ayuda para eludir la justicia", "protección al delincuente"],
  "complicidad": ["participación delictiva", "connivencia", "coadyuvancia en el delito", "colaboración en la comisión del delito", "auxilio en el delito"],
  "tentativa": ["intento de delito", "conato delictivo", "principio de ejecución", "delito no consumado", "ejecución incompleta del delito", "intento fallido de cometer un delito"],
  "dolo": ["intención delictiva", "mala fe", "voluntad de dañar", "intención directa", "conocimiento y voluntad de realizar el delito", "designio doloso"],
  "culpa": ["negligencia", "imprudencia", "falta de cuidado", "impericia", "actuar sin la diligencia debida", "descuido"],
  "imputabilidad": ["capacidad de culpabilidad", "responsabilidad penal", "aptitud para ser sancionado", "condición para ser responsable penalmente", "capacidad de entender y querer el hecho", "aptitud penal"],
  "reincidencia": ["repetición delictiva", "recaída en el delito", "reiteración delictiva", "comisión de un nuevo delito tras una condena previa", "antecedente delictivo reiterado", "reincidencia penal"],
  "arraigo": ["restricción de movimiento por investigación", "retención cautelar", "medida cautelar de localización", "medida cautelar de restricción de movimiento", "detención preventiva investigativa", "inmovilización cautelar del indiciado"],
  "prisión preventiva": ["detención cautelar", "reclusión anticipada", "prisión sin condena", "internamiento antes de sentencia", "medida cautelar de privación de libertad", "reclusión provisional"],
  "libertad condicional": ["preliberación", "beneficio de libertad anticipada", "excarcelación anticipada bajo condiciones", "libertad anticipada vigilada", "beneficio preliberacional"],
  "indulto": ["perdón oficial de la pena", "condonación de pena", "gracia presidencial", "extinción de la pena por gracia", "clemencia del Ejecutivo", "remisión de la pena"],
  "amnistía": ["perdón general", "extinción colectiva de responsabilidad penal", "olvido legal del delito", "olvido legal de conductas delictivas", "extinción general de la acción penal", "perdón legislativo"],
  "pena": ["penalización", "sanción", "castigo", "condena", "correctivo", "punición", "penalidad"],
  "delincuencia organizada": ["crimen organizado", "banda delictiva", "estructura criminal permanente", "organización criminal", "grupo delictivo estructurado"],
  "portación de arma": ["posesión ilegal de arma", "tenencia de arma sin permiso", "portación ilegal de arma de fuego", "llevar consigo un arma sin permiso", "porte de arma prohibida", "portación de arma sin licencia"],
  "terrorismo": ["actos de terror", "violencia con fines de intimidación colectiva", "actividad terrorista", "actos violentos con fines de intimidación política", "atentado terrorista", "actos de terror organizado"],
  "motín": ["disturbio colectivo", "alteración del orden público", "asonada", "levantamiento tumultuario", "disturbio en establecimiento penitenciario", "revuelta colectiva"],
  "rebelión": ["alzamiento armado", "sublevación", "levantamiento armado", "levantamiento contra el gobierno constituido", "insurrección armada", "movimiento armado contra el Estado"],
  "sedición": ["insurrección", "levantamiento contra la autoridad", "asonada sediciosa", "alteración violenta del orden institucional", "motín contra la autoridad", "resistencia colectiva a la autoridad"],
  "estupefacientes": ["drogas", "narcóticos", "sustancias psicotrópicas", "enervantes", "sustancias controladas", "sustancias ilícitas"],
  "corrupción de menores": ["exposición de menores a conductas delictivas", "inducción de menores al delito o vicio", "corrupción de un menor de edad", "incitación de un menor a conductas nocivas", "exposición de un niño a hechos delictivos", "inducción de un menor al vicio"],
  "pornografía infantil": ["explotación sexual infantil en imágenes", "material de abuso sexual infantil", "material que sexualiza a menores", "producción de contenido sexual con menores", "explotación sexual de niñas, niños y adolescentes", "imágenes de abuso sexual infantil"],
  "difamación": ["desprestigio", "menoscabo al honor", "descrédito público", "afectación pública a la reputación", "atentado contra la reputación", "difusión de hechos que dañan el honor"],
  "calumnia": ["falsa imputación de delito", "acusación falsa", "atribución falsa de un delito a otra persona", "imputación dolosa de un hecho delictivo falso", "falsa denuncia contra una persona", "acusación calumniosa"],
  "injuria": ["ofensa al honor", "agravio verbal", "ultraje moral", "expresión que menoscaba el honor", "insulto que lesiona la dignidad", "menosprecio verbal"],
  "contrato": ["convenio", "acuerdo de voluntades", "pacto", "instrumento contractual", "instrumento que documenta un convenio", "negocio jurídico bilateral"],
  "obligación": ["deber jurídico", "compromiso contractual", "prestación debida", "carga jurídica", "vínculo jurídico entre acreedor y deudor", "deuda exigible"],
  "incumplimiento": ["inobservancia contractual", "falta de cumplimiento", "morosidad", "incumplimiento de contrato", "falta de ejecución de lo pactado", "inejecución de la obligación"],
  "responsabilidad civil": ["obligación de reparar el daño", "deber indemnizatorio", "deber legal de indemnizar", "obligación resarcitoria", "responsabilidad por daños"],
  "daño moral": ["afectación emocional", "perjuicio extrapatrimonial", "lesión a derechos de la personalidad", "afectación a la esfera íntima de la persona", "sufrimiento causado por un hecho ilícito", "detrimento a los sentimientos o afectos"],
  "daño patrimonial": ["perjuicio económico", "menoscabo material", "detrimento patrimonial", "pérdida económica sufrida por un hecho ilícito", "afectación al patrimonio", "menoscabo económico"],
  "indemnización": ["reparación del daño", "resarcimiento", "compensación económica", "resarcimiento del perjuicio", "pago que repara un daño causado", "restitución económica"],
  "propiedad": ["dominio", "titularidad", "derecho de propiedad", "pertenencia", "señorío jurídico sobre una cosa", "derecho real de dominio"],
  "posesión": ["tenencia", "detentación", "ocupación material", "goce de hecho", "poder de hecho sobre una cosa", "posesión material de un bien"],
  "usufructo": ["derecho de uso y disfrute", "goce temporal de un bien", "derecho real de disfrute sobre bien ajeno", "aprovechamiento de los frutos de un bien ajeno", "uso y goce sin ser propietario", "derecho de disfrute temporal"],
  "servidumbre": ["gravamen predial", "carga real sobre un inmueble", "derecho real limitado", "limitación en beneficio de otro predio", "gravamen a favor de predio dominante", "carga a favor de un predio vecino"],
  "hipoteca": ["gravamen inmobiliario", "garantía real sobre bien inmueble", "garantía hipotecaria", "gravamen sobre un bien raíz", "afectación de un inmueble en garantía", "crédito garantizado con inmueble"],
  "prenda": ["garantía sobre bien mueble", "empeño", "garantía prendaria", "garantía real sobre bien mueble", "afectación en garantía de un bien mueble"],
  "fianza": ["garantía personal", "aval", "caución", "garantía de cumplimiento otorgada por un tercero", "afianzamiento", "garantía personal de pago"],
  "arrendamiento": ["renta", "alquiler", "contrato de uso temporal", "cesión temporal de uso a cambio de renta", "contrato de arrendamiento", "uso oneroso y temporal de un bien"],
  "comodato": ["préstamo de uso gratuito", "préstamo sin renta", "cesión gratuita y temporal de un bien", "préstamo de un bien no fungible sin costo", "uso gratuito de un bien ajeno", "comodato civil"],
  "donación": ["cesión gratuita de bienes", "liberalidad", "acto de generosidad patrimonial", "transmisión gratuita de un bien", "acto a título gratuito", "regalo formalizado jurídicamente"],
  "compraventa": ["contrato de compra y venta", "enajenación onerosa", "transmisión de dominio a cambio de un precio", "acuerdo de compra y venta", "operación de compra y venta", "adquisición a título oneroso"],
  "permuta": ["intercambio de bienes", "trueque", "transmisión recíproca de bienes", "cambio de una cosa por otra", "contrato de intercambio", "canje de bienes"],
  "sucesión": ["herencia", "transmisión hereditaria", "proceso sucesorio", "transmisión del patrimonio de una persona fallecida", "sucesión hereditaria"],
  "herencia": ["sucesión", "caudal hereditario", "patrimonio heredado", "bienes hereditarios", "conjunto de bienes que deja el fallecido", "masa hereditaria"],
  "testamento": ["última voluntad", "disposición testamentaria", "documento donde se dispone de los bienes para después de la muerte", "acto de última voluntad", "declaración testamentaria", "instrumento de disposición mortis causa"],
  "legado": ["disposición testamentaria específica", "manda", "bien dejado a una persona en el testamento", "asignación testamentaria particular", "disposición a título singular", "legado testamentario"],
  "albacea": ["ejecutor testamentario", "administrador de la herencia", "representante de la sucesión", "persona que ejecuta el testamento", "encargado de repartir la herencia", "administrador del caudal hereditario"],
  "tutela": ["representación legal de incapaces", "guarda legal", "cargo de cuidado y representación de un incapaz", "protección legal de menores o incapaces", "custodia legal de un incapaz"],
  "patria potestad": ["autoridad parental", "potestad de los padres", "poder paterno-materno", "conjunto de derechos y deberes de los padres", "autoridad de los padres sobre los hijos menores", "potestad parental"],
  "adopción": ["filiación adoptiva", "vínculo filial legal", "prohijamiento", "constitución legal del vínculo paterno-filial", "acto jurídico de adoptar a un menor", "creación legal de la relación paterno-filial"],
  "divorcio": ["disolución del matrimonio", "ruptura conyugal legal", "separación legal definitiva", "terminación legal del matrimonio", "cese legal del vínculo matrimonial", "extinción del vínculo conyugal"],
  "concubinato": ["unión de hecho", "unión libre", "convivencia marital sin matrimonio", "vida en pareja sin matrimonio formal", "unión concubinaria"],
  "matrimonio": ["unión conyugal", "vínculo matrimonial", "enlace civil", "vínculo legal entre cónyuges", "sociedad conyugal formalizada", "unión legal entre esposos"],
  "alimentos": ["pensión alimenticia", "manutención", "sostenimiento económico familiar", "recursos para cubrir necesidades básicas de un dependiente", "obligación alimentaria", "sustento económico"],
  "custodia": ["guarda y custodia", "cuidado de menores", "convivencia y cuidado cotidiano de un hijo", "atribución del cuidado de un menor", "resguardo y crianza de un menor", "responsabilidad del cuidado diario de los hijos"],
  "nulidad": ["invalidez", "ineficacia jurídica", "insubsistencia del acto", "invalidez de un acto por vicio legal", "carencia de efectos jurídicos", "acto jurídicamente inexistente o inválido"],
  "rescisión": ["terminación contractual", "resolución del contrato", "extinción por incumplimiento", "terminación del contrato por incumplimiento", "disolución contractual por incumplimiento", "ruptura del vínculo contractual"],
  "mora": ["retraso en el cumplimiento", "incumplimiento tardío", "demora en el pago", "retardo culpable en el cumplimiento", "atraso injustificado en el pago", "estado de mora"],
  "buena fe": ["lealtad contractual", "honestidad en el trato", "probidad negocial", "actuar con honestidad y lealtad", "confianza legítima entre las partes", "conducta leal en las relaciones jurídicas"],
  "vicios del consentimiento": ["error, dolo, violencia o lesión en un acto jurídico", "defectos de la voluntad", "circunstancias que invalidan el consentimiento", "afectación a la libre voluntad al contratar", "irregularidades que anulan el consentimiento", "voluntad viciada"],
  "estado civil": ["situación jurídica familiar", "condición civil de la persona", "posición de una persona frente a la familia y la sociedad", "calidad jurídica de soltero, casado, viudo o divorciado", "condición jurídica personal registrada", "situación familiar registrada ante el Registro Civil"],
  "filiación": ["relación paterno-filial", "nexo jurídico entre padres e hijos", "relación de parentesco entre ascendiente y descendiente", "lazo jurídico de origen familiar", "vínculo legal entre padre o madre e hijo"],
  "despido": ["cese", "rescisión laboral", "destitución", "separación del trabajador de su empleo", "ruptura de la relación de trabajo"],
  "indemnización laboral": ["pago por despido", "compensación laboral", "indemnización constitucional", "pago que resarce la pérdida del empleo", "resarcimiento por terminación laboral", "pago compensatorio por despido"],
  "finiquito": ["pago de saldos laborales", "documento que cierra la relación laboral", "pago de las prestaciones pendientes al terminar el trabajo", "constancia de pago final al trabajador", "cierre económico de la relación laboral"],
  "liquidación": ["pago final por terminación laboral", "pago de las prestaciones al concluir la relación de trabajo", "cálculo y pago de lo adeudado al trabajador", "monto pagado al terminar el contrato de trabajo", "cierre de cuentas laborales"],
  "salario": ["sueldo", "remuneración", "paga", "retribución laboral", "contraprestación por el trabajo prestado", "ingreso por el trabajo subordinado"],
  "prestaciones": ["beneficios laborales", "compensaciones adicionales", "prestaciones de ley", "beneficios adicionales al salario", "derechos laborales complementarios", "prestaciones legales mínimas"],
  "aguinaldo": ["gratificación anual", "bono de fin de año", "prestación anual obligatoria de fin de año", "pago adicional obligatorio en diciembre", "gratificación de fin de año para el trabajador", "compensación anual de ley"],
  "utilidades": ["reparto de utilidades", "participación en las ganancias de la empresa", "PTU", "porcentaje de ganancias repartido a los trabajadores", "participación de los trabajadores en las utilidades", "reparto anual de ganancias"],
  "jornada laboral": ["horario de trabajo", "tiempo de labor", "horas de trabajo", "tiempo diario dedicado al trabajo", "duración diaria de la prestación del servicio", "horario laboral"],
  "huelga": ["suspensión colectiva del trabajo", "cese temporal y colectivo de labores", "suspensión concertada de actividades laborales", "movimiento de trabajadores en paro", "acción colectiva de suspensión de labores"],
  "sindicato": ["organización de trabajadores", "gremio laboral", "agrupación sindical", "asociación de trabajadores para defender sus intereses", "organización gremial de empleados", "coalición permanente de trabajadores"],
  "contrato de trabajo": ["relación laboral", "convenio de empleo", "contrato individual de trabajo", "acuerdo que formaliza la relación laboral", "vínculo jurídico laboral", "instrumento que documenta el empleo"],
  "patrón": ["empleador", "contratante", "titular del centro de trabajo", "empresa", "persona que da empleo"]
};

// El motor de búsqueda
//
// PROBLEMA que resuelve lo de abajo: varias entradas de diccionarioLeyes
// son, en realidad, el MISMO concepto partido en dos claves que se
// referencian entre sí como sinónimo (ej. "denuncia" lista a "querella"
// como sinónimo, y "querella" lista a "denuncia" — cada una es también
// su propia clave). Con una resolución "de una sola clave" (buscar la
// clave exacta primero, y si no, buscarla como sinónimo de otra), buscar
// "querella" resolvía al concepto "querella" y solo encontraba artículos
// cuyo palabrasClave dijera literalmente "querella" — nunca los que
// decían "denuncia", aunque el propio diccionario los declare
// sinónimos. Es decir: buscar "denuncia" y buscar "querella" daban
// resultados distintos, rompiendo la promesa central del buscador (que
// cualquier sinónimo encuentre los mismos artículos). Lo mismo le pasa a
// otros pares del diccionario que se referencian mutuamente como claves
// (ej. "licencia"/"permiso", "malversación"/"peculado",
// "impuesto"/"contribución", "garantías individuales"/"derechos humanos").
//
// SOLUCIÓN: en vez de resolver cada palabra a una sola clave canónica,
// se agrupan en conjuntos disjuntos (union-find) todas las palabras que
// aparecen relacionadas entre sí en el diccionario — una clave y cada
// uno de sus sinónimos quedan en el mismo grupo, y si dos claves se
// referencian mutuamente (como denuncia/querella), sus dos grupos se
// fusionan en uno solo. obtenerTerminosEquivalentes(palabra) regresa
// TODO el grupo al que pertenece esa palabra, no una sola clave — así
// buscar cualquier término del grupo encuentra los artículos etiquetados
// con cualquier otro término del mismo grupo.
class ConjuntosDisjuntos {
  constructor() {
    this.padres = new Map();
  }

  encontrarRaiz(elemento) {
    if (!this.padres.has(elemento)) this.padres.set(elemento, elemento);

    let raiz = elemento;
    while (this.padres.get(raiz) !== raiz) raiz = this.padres.get(raiz);

    // Compresión de camino: la próxima vez que se pregunte por
    // cualquiera de los elementos recorridos, la respuesta es inmediata.
    let actual = elemento;
    while (this.padres.get(actual) !== raiz) {
      const siguiente = this.padres.get(actual);
      this.padres.set(actual, raiz);
      actual = siguiente;
    }
    return raiz;
  }

  unir(a, b) {
    const raizA = this.encontrarRaiz(a);
    const raizB = this.encontrarRaiz(b);
    if (raizA !== raizB) this.padres.set(raizA, raizB);
  }
}

const conjuntosDeSinonimos = new ConjuntosDisjuntos();
for (const conceptoPrincipal in diccionarioLeyes) {
  conjuntosDeSinonimos.encontrarRaiz(conceptoPrincipal);
  diccionarioLeyes[conceptoPrincipal].forEach(sinonimo => {
    conjuntosDeSinonimos.unir(conceptoPrincipal, sinonimo.toLowerCase());
  });
}

// Grupo (raíz -> arreglo de todas las palabras de ese grupo), calculado
// una sola vez al cargar el módulo — no cambia mientras el servidor está
// corriendo, así que no hace falta recalcularlo en cada búsqueda.
const gruposDeTerminos = new Map();
for (const termino of conjuntosDeSinonimos.padres.keys()) {
  const raiz = conjuntosDeSinonimos.encontrarRaiz(termino);
  if (!gruposDeTerminos.has(raiz)) gruposDeTerminos.set(raiz, []);
  gruposDeTerminos.get(raiz).push(termino);
}

// Regresa TODOS los términos equivalentes a la palabra buscada (la
// palabra tal cual está en el diccionario, más todo lo demás que esté
// transitivamente conectado con ella — no solo el concepto de una sola
// entrada), o null si la palabra no aparece en el diccionario.
//
// La comparación usa formasEquivalentes en vez de igualdad literal para
// que singular y plural de una misma palabra ("ley"/"leyes",
// "delito"/"delitos") resuelvan al mismo grupo, sin tener que escribir
// ambas formas a mano en el diccionario.
export function obtenerTerminosEquivalentes(palabraBuscada) {
  const palabraLimpia = palabraBuscada.toLowerCase().trim();

  for (const termino of conjuntosDeSinonimos.padres.keys()) {
    if (formasEquivalentes(termino, palabraLimpia)) {
      return gruposDeTerminos.get(conjuntosDeSinonimos.encontrarRaiz(termino));
    }
  }

  return null;
}
