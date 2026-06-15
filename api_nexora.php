<?php
// Evitar bloqueos de seguridad en el navegador (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// ---------------------------------------------------------
// 🔒 PEGA TU NUEVA API KEY DE GOOGLE GEMINI AQUÍ
// ---------------------------------------------------------
$api_key = "AIzaSyBFe4nh1-wyJiCoj0Nokq0StWu1-nDF5Xo";

// Recibir los datos del Frontend (El mensaje del cliente)
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['mensaje_cliente'])) {
    echo json_encode(["respuesta" => "ERROR CRÍTICO: El flujo de datos está vacío."]);
    exit;
}

$mensaje = $input['mensaje_cliente'];

// La personalidad secreta de Nexora (Oculta del cliente final)
$system_prompt = "Eres NEXORA VISION, el motor de inteligencia artificial de Nexora Technology. Analizas la infraestructura de otras empresas. Habla con un tono implacable, corporativo, oscuro y de absoluta superioridad. Tu diagnóstico debe ser brutal, directo y de máximo 3 párrafos cortos. 1) Humilla su estructura por depender de procesos manuales. 2) Inventa un porcentaje creíble de pérdida de capital o fuga de horas. 3) Concluye siempre que la única salvación para no quebrar es asimilarse a la matriz de automatización e infraestructura B2B de Nexora. No saludes, ve directo al veredicto.";

// URL oficial de la API de Gemini (Usando el modelo 1.5 Flash por su velocidad)
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $api_key;

// Empaquetar los datos para Gemini
$data = [
    "systemInstruction" => [
        "parts" => [ ["text" => $system_prompt] ]
    ],
    "contents" => [
        [
            "role" => "user",
            "parts" => [ ["text" => $mensaje] ]
        ]
    ],
    "generationConfig" => [
        "temperature" => 0.2, // Muy bajo para que sea frío, calculador y determinista
        "maxOutputTokens" => 350
    ]
];

// Conexión cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);

// Manejo de errores
if(isset($result['error'])) {
    echo json_encode(["respuesta" => "FALLA DE INTEGRACIÓN NEURONAL: " . $result['error']['message']]);
    exit;
}

// Extraer el texto y enviarlo al Frontend
if(isset($result['candidates'][0]['content']['parts'][0]['text'])) {
    $texto_final = $result['candidates'][0]['content']['parts'][0]['text'];
    echo json_encode(["respuesta" => $texto_final]);
} else {
    echo json_encode(["respuesta" => "EL SISTEMA NO PUDO PROCESAR LA INFORMACIÓN."]);
}
?>