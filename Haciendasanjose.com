<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hacienda San José | Hotel Boutique</title>

<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">

<style>
body{
    margin:0;
    font-family:'Poppins', sans-serif;
    background:#f4f4f4;
    color:#333;
}

/* HERO */
.hero{
    background:url('https://images.unsplash.com/photo-1566073771259-6a8506099945') no-repeat center center/cover;
    height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    color:white;
    padding:20px;
}
.hero h1{font-size:50px;}
.hero p{font-size:22px;}
.btn{
    display:inline-block;
    margin-top:20px;
    padding:15px 30px;
    background:#c59d5f;
    color:white;
    text-decoration:none;
    border-radius:30px;
}

/* SECCIONES */
section{
    padding:60px 8%;
    text-align:center;
}

.grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
    gap:20px;
}

.card{
    background:white;
    border-radius:10px;
    overflow:hidden;
    box-shadow:0 5px 15px rgba(0,0,0,.1);
}

.card img{
    width:100%;
    height:200px;
    object-fit:cover;
}

footer{
    background:#111;
    color:#bbb;
    padding:20px;
}

/* WHATS */
.whatsapp{
    position:fixed;
    bottom:20px;
    right:20px;
    background:#25D366;
    color:white;
    padding:15px;
    border-radius:50px;
    text-decoration:none;
}

/* RESPONSIVE */
@media(max-width:768px){
    .hero h1{font-size:32px;}
    .hero p{font-size:16px;}
}
</style>
</head>

<body>

<div class="hero">
    <div>
        <h1>Hacienda San José</h1>
        <p>Descanso, lujo y tradición en un solo lugar</p>
        <a class="btn" href="#habitaciones">Ver habitaciones</a>
    </div>
</div>

<section>
    <h2>Nuestra Hacienda</h2>
    <p>Un hotel boutique donde la elegancia colonial y el confort moderno se unen para una experiencia única.</p>
</section>

<section id="habitaciones">
    <h2>Habitaciones</h2>
    <div class="grid">
        <div class="card">
            <img src="https://images.unsplash.com/photo-1590490360182-c33d57733427">
            <div style="padding:20px;">
                <h3>Habitación Deluxe</h3>
                <p>Comodidad y elegancia.</p>
            </div>
        </div>

        <div class="card">
            <img src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2">
            <div style="padding:20px;">
                <h3>Suite Colonial</h3>
                <p>Detalles únicos y amplitud.</p>
            </div>
        </div>

        <div class="card">
            <img src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b">
            <div style="padding:20px;">
                <h3>Suite Presidencial</h3>
                <p>Lujo y exclusividad.</p>
            </div>
        </div>
    </div>
</section>

<section>
    <h2>Amenidades</h2>
    <div class="grid">
        <div class="card"><div style="padding:20px;">Piscina</div></div>
        <div class="card"><div style="padding:20px;">WiFi Gratis</div></div>
        <div class="card"><div style="padding:20px;">Restaurante</div></div>
        <div class="card"><div style="padding:20px;">Eventos y Bodas</div></div>
    </div>
</section>

<footer>
    © 2026 Hacienda San José
</footer>

<a class="whatsapp" href="https://wa.me/5214770000000">WhatsApp</a>

</body>
</html>