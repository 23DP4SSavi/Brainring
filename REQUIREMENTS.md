# BrainRing prasību ieviešana

Avots: Brainring.pdf, 3.–8. lappuse. Saglabāts lietotāja pieprasītais melnbaltais dizains.

## Ieviests
- Esošais API: reģistrācija, pieslēgšanās, sesijas un modinātāju izveide, apskate, rediģēšana un dzēšana.
- Reģistrācijas forma: vārds, uzvārds (1–50 rakstzīmes), lietotājvārds (5–25 latīņu burti/cipari), e-pasts (līdz 100), paroles sarežģītības pārbaude un atkārtota parole. Papildu validācija pagaidām ir klientā.
- Profila sadaļa ar papildu datu saglabāšanu pārlūkā atsevišķi katram lietotāja ID. Paroles lokālajā krātuvē nesaglabā.
- Trīs skaņas veidi un skaļums katram modinātājam; preferences glabājas šajā pārlūkā. Skaņu pārņem arī pēc aktīva uzdevuma pārlādes šajā pārlūkā.
- Brainrot nosaukuma ievade. Atstarpes un reģistrs tiek normalizēti; esošajam API nosūta atbilstošā varianta indeksu, un pareizību pārbauda serveris. Matemātikas režīmi saglabāti.
- Administratora demonstrācija: meklējami parauga lietotāji, apstiprināma parauga dzēšana un lokāla attēlu galerija. Faila pārbaude (PNG/JPEG/WebP līdz 2 MB), nosaukums, pareizā atbilde, priekšskatījums, pievienošana un apstiprināma dzēšana. Attēli vēl nemaina servera jautājumus.
- Veiksmju/kļūdu paziņojumi, mobilais izkārtojums, melnais un baltais režīms.

## Nepieciešams turpmāks backend/platformas darbs
- Profila sinhronizācija, unikāli lietotājvārdi, e-pasta/paroles maiņa un jauno prasību servera validācija.
- Īsta profila dzēšana ar saistīto datu dzēšanu. Saskarnē ir paskaidrojums par nepieejamo darbību; konts netiek izlikts par dzēstu.
- Administratora autentifikācija un lomas, īsto lietotāju saraksts/meklēšana/dzēšana, attēlu augšupielāde serverī un publicēšana jautājumos. PDF minētie pieslēgšanās dati ir piemērs, nevis ieviests administratora konts.
- Tieša brīvteksta atbilžu pārbaude serverī, plašāka attēlu/jautājumu bibliotēka.
- Darbība aizvērtā lietotnē: vajadzīga platformas fona modinātāju integrācija. Tīmekļa versijai vajag atvērtu cilni un nomodā esošu ierīci.
- Lokālie profila dati un skaņas iestatījumi nesinhronizējas starp ierīcēm. Demonstrācijas lietotāju dzēšana ir tikai pašreizējā priekšskatījuma sesijā.

Backend faili nav mainīti.
