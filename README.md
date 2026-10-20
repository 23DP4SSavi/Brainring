# BrainRing

Modinātāja tīmekļa lietotne pēc pievienotā trīs ekrānu prototipa.
Vue 3 + Vite, Node.js + Express un SQLite. Vajadzīgs Node.js 24.14 vai jaunāks.

## Ātra palaišana

Komandas izpildi projekta saknes mapē:

```powershell
npm.cmd --prefix backend install
npm.cmd --prefix frontend install
npm.cmd --prefix frontend run build
npm.cmd --prefix backend start
```

Atver **http://localhost:3000**. Nospied **+ make an account** un izveido savu kontu.
Parolei jābūt vismaz 8 rakstzīmēm. Jaunam kontam ir prototipa parauga modinātāji
6:30 darba dienās un 8:15 sestdienā. Katrs lietotājs redz tikai savus modinātājus.
Projektā nav iepriekš izveidota demo konta; pirmajā palaišanā izveido jaunu kontu.

## Darbs ar kodu

Atver divus termināļus projekta saknes mapē.

Backend:

```powershell
npm.cmd --prefix backend run dev
```

Frontend:

```powershell
npm.cmd --prefix frontend run dev
```

Atver Vite terminālī norādīto adresi (parasti http://localhost:5173).
Vite pārsūta `/api` pieprasījumus backendam uz portu 3000.
PowerShell izmantojam `npm.cmd`, lai nav jāmaina sistēmas skriptu izpildes politika.

## Iespējas

- Reģistrācija, pieteikšanās, izrakstīšanās un “keep me logged in”.
- Modinātāja pievienošana, labošana, dzēšana un ieslēgšana/izslēgšana.
- Nedēļas dienu izvēle; neviena izvēlēta diena nozīmē vienreizēju modinātāju.
- Easy: saskaitīšana; Medium: reizināšana; Hard: attēla atpazīšana.
- “ring me!” ļauj uzreiz izmēģināt prototipa Hard jautājumu.
- Skaņa turpinās pēc nepareizas atbildes; pareizu atbildi pārbauda serveris.
- Nepabeigtais jautājums saglabājas arī pēc lapas pārlādēšanas.
- Dizains pielāgojas telefonam un datoram; fonti un attēli glabājas projektā.

Modinātāji izmanto ierīces vietējo laiku un darbojas, kamēr lapa ir atvērta,
backend ir palaists un ierīce ir nomodā. Pārlūks var ierobežot fona cilnes;
tā nav operētājsistēmas modinātāja aizstāšana. Ja vajadzīgs, nospied
“tap to enable sound”, lai atļautu skaņu pēc lapas pārlādes.

Paroles atjaunošana ar e-pastu vēl nav pieslēgta; “forgot?” to paskaidro.
Sākumā katram režīmam ir viens parauga jautājums.

## Dati un faili

- `frontend/src/App.vue`: ekrāni un lietotāja darbības.
- `frontend/src/style.css`: dizains un adaptīvais izkārtojums.
- `frontend/src/audio.js`: modinātāja skaņa.
- `backend/src/app.js`: kontu, modinātāju un jautājumu API.
- `backend/src/schema.sql`: SQL tabulas un sākotnējie jautājumi.
- `backend/data/brainring.sqlite`: automātiski izveidota lokālā datubāze; Git to ignorē.
- `ASSETS.md`: ģenerēto ilustrāciju apraksti un izmantotie uzvedņu teksti.

Paroles glabājas kā scrypt atvasinājumi ar individuālu sāli.
Sesijām izmanto HttpOnly sīkdatnes; datubāzē glabā sesijas tokena SHA-256 jaucējvērtību.
Node.js 24 var parādīt brīdinājumu par iebūvētā SQLite moduļa eksperimentālo statusu.

## Pārbaudes

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend run test:e2e
npm.cmd --prefix frontend run build
```

API pārbaudes izmanto atsevišķu pagaidu SQLite datubāzi. Pārlūka pārbaudes
palaiž atsevišķu backend uz 3019 un Vite uz 5179; lietotāja datubāzi tās nemaina.
Windows pārbaudēs izmanto instalēto Edge. Ja Edge nav pieejams, instalē Chromium:

```powershell
cd frontend
npx.cmd playwright install chromium
```

Pārlūka pārbaudes saglabā ekrānuzņēmumus `frontend/test-results/` (Git tos ignorē).
Pārbaudīta reģistrācija, pieteikšanās, datu saglabāšana, modinātāju darbības,
nepareiza/pareiza atbilde, nepabeigta jautājuma atjaunošana, plānots signāls
un vienreizēja modinātāja izslēgšanās. Pārbaudīti arī 320, 390 un 1440 px izkārtojumi.
