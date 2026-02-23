// Single Source of Truth voor Hugo's verkooptechnieken
export const technieken_index = {
  _meta: {
    version: "1.0.0",
    description: "Single Source of Truth voor Hugo's verkooptechnieken",
    last_updated: "2026-01-06",
    EPIC_structure: {
      "2.1": "Explore - Verken situatie met vraagtechnieken (2.1.1-2.1.6)",
      "2.2": "Probe - De P van ePic: hypothetische scenario's om bewustzijn te creëren",
      "2.3": "Impact - Vraag naar gevolgen en consequenties",
      "2.4": "Commitment - Bevestiging van begrip, sleutel naar fase 3"
    }
  },
  technieken: {
    "0": {
      nummer: "0",
      naam: "Pre-contactfase",
      fase: "0",
      is_fase: true,
      doel: "Alle voorbereidende stappen VÓÓR het eerste klantcontact. Een goede voorbereiding is 80% van het verkoopsucces.",
      themas: [],
      tags: ["voorbereiding", "research", "planning"],
      context_requirements: ["prospect_info", "sector_analyse", "concurrenten_info", "crm_historiek", "mentale_voorbereiding"],
      hoe: "Doe desktop research: prospect- en marktanalyse, SWOT-analyse, CRM-historiek raadplegen, ChatGPT voor informatie. Daarna One Minute Manager: mentaal voorbereiden, gefocust zijn, attitude en enthousiasme uitstralen, durven te durven.",
      stappenplan: [
        "Desktop Research: prospect- en marktanalyse uitvoeren",
        "SWOT-analyse maken van de prospect",
        "CRM-historiek raadplegen (notities, eerdere offertes, contacthistoriek)",
        "Informatie ophalen via ChatGPT/online bronnen",
        "One Minute Manager: mentaal voorbereiden vóór binnenkomst"
      ],
      voorbeeld: [
        "Goede voorbereiding is al 50% van uw succes",
        "Wie zich vergeet voor te bereiden, bereidt zich voor om vergeten te worden",
        "Uw toekomstige klanten zijn de huidige klanten van uw concurrent"
      ]
    },
    "1": {
      nummer: "1",
      naam: "Openingsfase",
      fase: "1",
      is_fase: true,
      doel: "Volg deze volgorde, tenzij klant spontaan een stap aanbrengt (dan overslaan en terug oppakken waar je zat).",
      themas: [],
      tags: ["eerste indruk", "vertrouwen", "klimaat"],
      hoe: "Creëer een koopklimaat (gun-effect), formuleer een gentleman's agreement, presenteer POP (Persoon, Organisatie, Proces), en stel de instapvraag om de klant te motiveren waarom het in zijn belang is om informatie te delen.",
      stappenplan: [
        "Koopklimaat creëren (gun-effect, eerste indruk)",
        "Gentleman's agreement formuleren (agenda afspreken)",
        "POP presenteren: Persoon, Organisatie, Proces uitleggen",
        "Instapvraag stellen naar Fase 2"
      ],
      voorbeeld: [
        "Koopklimaat: Observeer omgeving, vind aanknopingspunten",
        "Gentleman's agreement: 'Als ik eerst een paar vragen mag stellen, kan ik u daarna een gepersonaliseerd voorstel doen. Is dat oké?'",
        "Instapvraag: 'Mag ik u een paar vragen stellen om te begrijpen wat voor u belangrijk is?'"
      ]
    },
    "2": {
      nummer: "2",
      naam: "Ontdekkingsfase",
      fase: "2",
      is_fase: true,
      doel: "Breng noden, te verwerven voordelen, te vermijden nadelen en vooral baten in kaart. Expliciete BAAT afleiden uit een VOORDEEL, bevestigen met COMMITMENT en pas dan naar fase 3.",
      themas: ["Bron", "Motivatie", "Ervaring", "Verwachtingen", "Alternatieven", "Budget", "Timing", "Beslissingscriteria"],
      tags: ["EPIC", "vraagtechnieken", "behoefteanalyse"],
      hoe: "Gebruik het EPIC-model: Explore (feit-, mening- en alternatieve vragen over de 8 thema's), Probe (storytelling/hypothetische scenario's), Impact (consequentievragen), Commit (expliciete bevestiging van begrip). Creëer waarde door noden, voordelen, nadelen en vooral BATEN in kaart te brengen.",
      stappenplan: [
        "Explore (2.1): Stel feit-, mening- en alternatieve vragen over de 8 thema's (Bron, Motivatie, Ervaring, Verwachtingen, Alternatieven, Budget, Timing, Beslissingscriteria)",
        "Probe (2.2): Gebruik storytelling of hypothetische scenario's ('Stel dat...', 'Wat als...')",
        "Impact (2.3): Vraag naar gevolgen en consequenties ('Wat betekent dat voor u?')",
        "Commit (2.4): Vraag expliciete bevestiging van begrip voordat je naar Fase 3 gaat"
      ],
      voorbeeld: [
        "Explore: 'Hoe bent u bij ons terechtgekomen?' (Bron), 'Wat was de aanleiding?' (Motivatie)",
        "Probe: 'Stel dat u dit probleem zou kunnen oplossen, wat zou dat betekenen voor uw dagelijkse werk?'",
        "Impact: 'Wat zijn de gevolgen als dit zo blijft?'",
        "Commit: 'Als ik het goed begrijp, is X voor u het belangrijkste. Klopt dat?'"
      ]
    },
    "3": {
      nummer: "3",
      naam: "Aanbevelingsfase",
      fase: "3",
      is_fase: true,
      doel: "Verbind de baten uit fase 2 aan jouw concrete oplossing en USP's. Gebruik altijd O.V.B.: Oplossing → Voordeel → Baat. Vraag daarna naar de mening en lok een koopsignaal uit.",
      themas: ["USP's"],
      tags: ["O.V.B.", "oplossing", "voordeel", "baat"],
      hoe: "Behandel de belangrijkste verwachting eerst met O.V.B., vraag dan of je andere verwachtingen mag bespreken. Bij te hoge verwachtingen: erken, vraag naar prioriteiten, focus op wat haalbaar is. Bij geen verwachtingen: ga terug naar fase 2.",
      stappenplan: [
        "Behandel belangrijkste verwachting eerst met O.V.B.",
        "Vraag: 'Wilt u dat ik ook uw andere verwachting bespreek?'",
        "Te hoge verwachtingen: erken, vraag prioriteiten, focus op haalbaar",
        "Geen verwachtingen: terug naar fase 2 voor Explore/Probe/Impact vragen"
      ],
      voorbeeld: [
        "Klant: 'Het is te duur.' → O: 'Onze service kost €400/maand.' V: 'Daarmee bespaart u 8 uur per week.' B: 'Dat betekent dat u niet meer wakker ligt van administratie.'"
      ]
    },
    "4": {
      nummer: "4",
      naam: "Beslissingsfase",
      fase: "4",
      is_fase: true,
      doel: "Stuur naar beslissing, behandel resterende houdingen van de klant (afritten: vragen, twijfels, uitstel, bezwaren, risico's) en sluit af met de finale closing sequence. Gouden regel: vraag HOE, niet OF. Mindset: ga altijd uit van de koop.",
      themas: ["beslissing"],
      tags: ["closing", "ABC", "indien-techniek", "bezwaren"],
      hoe: "Ga er altijd van uit dat de klant gaat kopen. Dit is vertrouwen in je product en waarde. Je lichaamstaal, toon en woordkeuze moeten 'koop' uitstralen. Behandel decision barriers: vragen (info), twijfels (onzekerheid), uitstel (niet nu), bezwaren (tegenargumenten), angst (emotioneel), risico-inschatting (rationeel).",
      stappenplan: [
        "Proefafsluiting doen",
        "ABC-techniek toepassen (Always Be Closing)",
        "Indien-techniek gebruiken",
        "Afritten behandelen (vragen, twijfels, uitstel, bezwaren, angst, risico)",
        "Finale closing: samenvatten, verwachtingen-oplossing koppelen, CVP bevestigen, alternatieve keuze, order schrijven"
      ],
      voorbeeld: [
        "Niet: 'Als u zou willen kopen...' maar 'Wanneer u begint met...'",
        "Niet: 'Wilt u dit?' maar 'Hoe wilt u dit?'",
        "Niet: 'Mag ik u een offerte sturen?' maar 'Ik stuur u maandag de offerte, is dat oké?'"
      ]
    },
    "1.1": {
      nummer: "1.1",
      naam: "Koopklimaat creëren",
      doel: "Vertrouwen en sympathie opbouwen zodat de klant openstaat voor het gesprek.",
      fase: "1",
      parent: "1",
      wat: "Gedrag, onderwerpkeuze en presentatie aanpassen aan interesses en sfeer van klant.",
      waarom: "Om vertrouwen en comfort te creëren zodat de klant je de verkoop gunt ('gun-effect').",
      wanneer: "Direct bij aanvang van gesprek.",
      hoe: "Gebruik observaties (omgeving, kledingstijl) en persoonlijke aanpassingen om aansluiting te vinden.",
      voorbeeld: ["Kostuumvest uitdoen wanneer de klant duidelijk casual gekleed is."],
      stappenplan: [
        "Observeer klant en omgeving.",
        "Pas eigen gedrag/uiterlijk aan.",
        "Begin met een persoonlijk of luchtig onderwerp, geen product."
      ],
      tags: ["vertrouwen", "aanvang", "klantgericht"]
    },
    "1.2": {
      nummer: "1.2",
      naam: "Gentleman's agreement",
      doel: "Gespreksleiding nemen en verwachtingen afstemmen zodat de klant weet wat komen gaat.",
      fase: "1",
      parent: "1",
      wat: "Duidelijke afspraken maken over het verloop van gesprek (gespreksleiding nemen).",
      waarom: "Om controle te houden en het gesprek strategisch te sturen.",
      wanneer: "Altijd na het creëren van koopklimaat.",
      hoe: "Overloop agenda duidelijk en vraag expliciet akkoord.",
      voorbeeld: [
        "'t Zal de bedoeling zijn vandaag om even kennis te maken. Enerzijds wie wij zijn, wat wij doen, anderzijds wat u precies verwacht. Iemand als u zal daar ongetwijfeld zijn idee over hebben. Als het niet past, verdoen we op die manier niet lang elkaars tijd; klikt het wel, dan overlopen we hoe we kunnen samenwerken. Is dat goed voor u als we zo te werk gaan?"
      ],
      stappenplan: [
        "Stel kort het doel en de structuur voor.",
        "Vraag expliciet akkoord.",
        "Zorg voor een vriendelijke en duidelijke toon."
      ],
      tags: ["vertrouwen", "aanvang", "klantgericht"]
    },
    "1.3": {
      nummer: "1.3",
      naam: "Firmavoorstelling + reference story",
      doel: "Geloofwaardigheid opbouwen door concrete resultaten en referenties te tonen.",
      fase: "1",
      parent: "1",
      wat: "Korte introductie van jezelf en bedrijf gekoppeld aan concrete referenties en prestaties.",
      waarom: "Interesse wekken en gesprek richten naar sterke punten (USP's) van jouw oplossing.",
      wanneer: "Na gentleman's agreement.",
      hoe: "Presenteer duidelijk, compact en met overtuigende cijfers en herkenbare klanttypes.",
      voorbeeld: [
        "Ik werk voor projectontwikkelaar XYZ, we bestaan 20 jaar en hebben ondertussen 1400 appartementen, 1200 woningen, 3 publieke parkings, 10 hotels en 4 vakantieparken gebouwd..."
      ],
      stappenplan: [
        "Kies referentie die aansluit bij klanttype.",
        "Geef beknopt aantal relevante cijfers.",
        "Verbind je bedrijfspitch aan klantnoden."
      ],
      tags: ["USP", "introductie", "interesse"]
    },
    "1.4": {
      nummer: "1.4",
      naam: "Instapvraag",
      doel: "De klant motiveren om informatie te delen door het belang voor hem te benadrukken.",
      fase: "1",
      parent: "1",
      wat: "Open vraag die klant uitnodigt om situatie te beschrijven.",
      waarom: "Klant activeren en informatie verkrijgen over situatie en behoeften.",
      wanneer: "Direct na firmavoorstelling.",
      hoe: "Stel vraag op uitnodigende, open manier.",
      voorbeeld: ["Vertel eens, meneer en mevrouw X, hoe mag ik jullie situatie inschatten?"],
      stappenplan: [
        "Gebruik een neutrale open vraag.",
        "Laat klant uitpraten.",
        "Luister aandachtig en stel eventueel een vervolgvraag."
      ],
      tags: ["open vraag", "informatie", "activeren"]
    },
    "2.1": {
      nummer: "2.1",
      naam: "Explore",
      doel: "De situatie, behoeften en context van de klant verkennen om waarde te kunnen creëren.",
      fase: "2",
      parent: "2",
      wat: "De Explore-stap in de EPIC-methode: verken de situatie, behoeften en context van de klant door gerichte vraagtechnieken.",
      waarom: "Om voldoende informatie te verzamelen voordat je naar Probe, Impact en Commitment gaat. Zonder goede exploratie kun je geen gerichte impact maken.",
      wanneer: "Direct na de openingsfase (1.4 Instapvraag) - dit is het begin van fase 2.",
      hoe: "Gebruik een mix van feit-, mening- en alternatieve vragen om de situatie te verkennen. Luister actief en speel in op wat de klant zegt.",
      voorbeeld: ["Start met feitvragen om de huidige situatie te begrijpen, wissel af met meningsvragen om drijfveren te ontdekken."],
      stappenplan: [
        "Start met feitvragen (2.1.1) om situatie te begrijpen",
        "Wissel af met meningsvragen (2.1.2) voor drijfveren",
        "Gebruik alternatieve vragen (2.1.3) bij onduidelijkheid",
        "Pas ter zijde schuiven (2.1.4) toe als de klant te vroeg zelf vragen begint te stellen",
        "Gebruik pingpong (2.1.5) voor verduidelijking",
        "Luister actief (2.1.6) en toon empathie"
      ],
      tags: ["exploratie", "vraagtechniek", "ontdekking", "EPIC"]
    },
    "2.1.1": {
      nummer: "2.1.1",
      naam: "Feitgerichte vragen",
      doel: "Concrete feiten en cijfers verzamelen om een gepersonaliseerde oplossing te kunnen bouwen.",
      fase: "2",
      parent: "2.1",
      wat: "Gericht vragen naar feiten, cijfers of specifieke informatie rond de 8 Discovery-thema's.",
      waarom: "Om gesprek strategisch te sturen richting voordelen van jouw oplossing.",
      wanneer: "Tijdens begin ontdekkingsfase, om gesprek positief te beïnvloeden.",
      hoe: "Stel duidelijke, feitelijke vragen gericht op specifieke details binnen de thema's: Bron, Motivatie, Ervaring, Verwachtingen, Alternatieven, Budget, Timing, Beslissingscriteria.",
      voorbeeld: [
        "Hoe bent u bij ons terechtgekomen?",
        "Welke ervaring heeft u al met ...?",
        "Wat verwacht u van ...?"
      ],
      themas: ["Bron", "Motivatie", "Ervaring", "Verwachtingen", "Alternatieven", "Budget", "Timing", "Beslissingscriteria"],
      tags: ["feitvragen", "discovery", "themas"]
    },
    "2.1.2": {
      nummer: "2.1.2",
      naam: "Meningsgerichte vragen",
      doel: "Dieper inzicht krijgen in de motivatie achter de feiten.",
      fase: "2",
      parent: "2.1",
      wat: "Open vragen die klant stimuleren mening of gevoelens te delen.",
      waarom: "Om diepere inzichten te krijgen in behoeften en wensen.",
      wanneer: "Tijdens ontdekkingsfase om klant aan het praten te krijgen.",
      hoe: "Stel open vragen waarop niet met ja/nee geantwoord kan worden.",
      voorbeeld: [
        "Waarom wel? Waarom niet? Hoe ziet u dat?",
        "Wat vindt u belangrijk aan ...?"
      ],
      tags: ["meningsvragen", "drijfveren", "open vragen"]
    },
    "2.1.3": {
      nummer: "2.1.3",
      naam: "Feitgerichte vragen onder alternatieve vorm",
      doel: "Concrete antwoorden verkrijgen van klanten die vaag of niet-communicatief zijn.",
      fase: "2",
      parent: "2.1",
      wat: "Duidelijke keuzevragen om standpunt klant helder te krijgen.",
      waarom: "Om twijfels of vaagheden op te helderen.",
      wanneer: "Bij onduidelijke of aarzelende antwoorden van klant.",
      hoe: "Geef klant expliciete keuze tussen twee opties.",
      voorbeeld: [
        "Is het omdat ... of omdat u liever ...?",
        "Zoekt u ... of eerder ...?"
      ],
      tags: ["alternatieve vragen", "keuze", "verduidelijking"]
    },
    "2.1.4": {
      nummer: "2.1.4",
      naam: "Ter zijde schuiven",
      doel: "Verwachtingen of vragen parkeren zodat je eerst waarde kunt creëren.",
      fase: "2",
      parent: "2.1",
      wat: "Gesprek wegsturen van premature bezwaren om deze op later, strategischer moment aan bod te laten komen.",
      waarom: "Om eerst positief gesprek te richten op USP's voordat nadelen besproken worden.",
      wanneer: "Bij vroege bezwaren of vragen over nadelen.",
      hoe: "Erken bezwaar kort, schuif het tijdelijk opzij en leid gesprek naar positieve aspecten.",
      voorbeeld: [
        "Onafgezien de prijs... wat vindt u nog belangrijk?",
        "Goede vraag, hou dat even bij, maar laat mij eerst eens vragen..."
      ],
      tags: ["parkeren", "bezwaren", "strategie"]
    },
    "2.1.5": {
      nummer: "2.1.5",
      naam: "Pingpong techniek",
      doel: "De klant vragen teruggeven om hem aan het praten te krijgen.",
      fase: "2",
      parent: "2.1",
      wat: "Doorvragen op antwoorden van klant om volledige duidelijkheid te krijgen.",
      waarom: "Om misverstanden of vage antwoorden te vermijden.",
      wanneer: "Bij elk mogelijk misverstand of korte, vage antwoorden.",
      hoe: "Vraag direct verduidelijking of nadere uitleg.",
      voorbeeld: [
        "Hoe bedoelt u?",
        "Wat bedoelt u wanneer u zegt...?",
        "Echt? Hoe zit dat precies?"
      ],
      tags: ["pingpong", "verduidelijking", "doorvragen"]
    },
    "2.1.6": {
      nummer: "2.1.6",
      naam: "Actief en empathisch luisteren",
      doel: "Tonen dat je de klant begrijpt en hem aanmoedigen om door te praten.",
      fase: "2",
      parent: "2.1",
      wat: "Actief luisteren en empathie tonen zodat klant zich gehoord voelt.",
      waarom: "Omdat je dan leert wat echt belangrijk is voor de klant én vertrouwen opbouwt.",
      wanneer: "Gedurende hele ontdekkingsfase.",
      hoe: "Gebruik technieken als ondersteuning, aansporing, empathie tonen, herhalen/parafraseren.",
      voorbeeld: [
        "Hm, hoofdknikken, interesse laten blijken",
        "Dus u bedoelt ...",
        "Dat begrijp ik, daar kan ik inkomen."
      ],
      tags: ["luisteren", "empathie", "vertrouwen"]
    },
    "2.2": {
      nummer: "2.2",
      naam: "Probe",
      doel: "De klant laten nadenken over hypothetische scenario's om latente behoeften bloot te leggen.",
      fase: "2",
      parent: "2",
      wat: "Suggestieve vraagstelling met behulp van storytelling.",
      waarom: "Om de prospect de ernst van een probleem beter te helpen begrijpen of van gedacht te doen veranderen zonder discussie.",
      wanneer: "Wanneer klant belang van een USP niet inziet of negatief reageert.",
      hoe: "Gebruik verhalen of hypothetische situaties: 'Stel dat…', 'Wat als…', en sluit af met een open mening-vraag.",
      voorbeeld: [
        "Indien u met de ervaring die u hebt, die beslissing zou kunnen hernemen, wat zou u anders doen?",
        "Stel dat u voor een vergelijkbare situatie komt te staan, hoe zou u dat aanpakken?"
      ],
      stappenplan: [
        "Bepaal het punt waarop klant vasthoudt aan een (onjuiste) overtuiging.",
        "Vertel een kort, herkenbaar verhaal of schets een hypothetische situatie.",
        "Stel daarna een mening-vraag aan klant."
      ],
      tags: ["storytelling", "inzicht", "overtuigen"]
    },
    "2.3": {
      nummer: "2.3",
      naam: "Impact / Gevolg vragen",
      doel: "De klant bewust maken van de gevolgen van zijn huidige situatie of van niet-handelen.",
      fase: "2",
      parent: "2",
      wat: "Vraag naar de consequenties of gevolgen van een situatie voor de klant.",
      waarom: "Om de klant bewust te maken van de impact en urgentie te creëren.",
      wanneer: "Na het identificeren van een probleem of behoefte.",
      hoe: "Stel vragen als 'Wat betekent dat voor u?', 'Wat zijn de gevolgen als...?'",
      voorbeeld: [
        "Wat betekent dat concreet voor jullie?",
        "Wat zijn de gevolgen als dit zo doorgaat?"
      ],
      stappenplan: [
        "Identificeer probleem of behoefte.",
        "Vraag naar concrete gevolgen.",
        "Laat klant reflecteren en impact benoemen."
      ],
      tags: ["impact", "consequenties", "urgentie"]
    },
    "2.4": {
      nummer: "2.4",
      naam: "Commitment",
      doel: "Expliciete bevestiging krijgen dat de klant de behoefte erkent voordat je naar fase 3 gaat.",
      fase: "2",
      parent: "2",
      wat: "Een controlevraag waarmee je bevestigt of je de visie, verwachtingen of pijnpunten van de klant goed begrepen hebt.",
      waarom: "Om na te gaan of je goed begrijpt wat de klant écht belangrijk vindt en om de klant in een 'ja-ritme' te brengen. Dit is de SLEUTEL om naar fase 3 te mogen gaan.",
      wanneer: "Tijdens de ganse ontdekkingsfase, telkens de klant zich positief uitlaat. ESSENTIEEL vóór overgang naar fase 3, NA impact is gemaximaliseerd.",
      hoe: "Herhaal of parafraseer wat de klant heeft gezegd. Vraag expliciet om bevestiging. Gebruik ZOWEL 'verwerven' (voor promotors) ALS 'vermijden' (voor analyseerders).",
      voorbeeld: [
        "Dus als ik u goed begrijp, meneer, is het belangrijk voor u om [baat X] te verwerven én [pijnpunt Y] te vermijden?",
        "Dus zekerheid is voor jullie de belangrijkste factor om te verwerven, en onverwachte kosten wilt u vermijden?",
        "Als ik het samenvat: u wilt [voordeel] bereiken en [nadeel] voorkomen, klopt dat?"
      ],
      stappenplan: [
        "Herken een positief klantensignaal na impact-vraag.",
        "Formuleer commitment met VERWERVEN: 'Dus u wilt [baat/voordeel] bereiken?'",
        "Voeg VERMIJDEN toe: 'En [pijnpunt/nadeel] wilt u vermijden?'",
        "Wacht op duidelijke 'ja' of bevestiging.",
        "Bij JA: ga naar fase 3 met O.V.B.",
        "Bij NEEN of twijfel: doorvragen met Explore/Probe/Impact."
      ],
      tags: ["controle", "samenvatting", "zekerheid", "overgang fase 3", "verwerven", "vermijden"]
    },
    "3.1": {
      nummer: "3.1",
      naam: "Empathie tonen",
      doel: "De klant laten bevestigen dat je zijn situatie correct begrepen hebt.",
      fase: "3",
      parent: "3",
      wat: "Toon begrip voor wat de prospect belangrijk vindt.",
      waarom: "Om vertrouwen te versterken en klant te laten voelen dat je luistert.",
      wanneer: "Bij start van aanbevelingsfase.",
      hoe: "Verwijs naar wat klant eerder zei, toon dat je het begrepen hebt.",
      voorbeeld: ["Ik begrijp dat zekerheid voor u heel belangrijk is."],
      stappenplan: [
        "Herinner je wat klant zei in fase 2.",
        "Toon dat je het begrijpt.",
        "Maak overgang naar oplossing."
      ],
      tags: ["empathie", "vertrouwen", "luisteren"]
    },
    "3.2": {
      nummer: "3.2",
      naam: "Oplossing presenteren",
      doel: "De klantbehoeften expliciet verbinden aan kenmerken van je oplossing.",
      fase: "3",
      parent: "3",
      wat: "Presenteer je oplossing of product als antwoord op de klantbehoefte.",
      waarom: "Om de klant te laten zien dat jouw aanbod past bij wat hij zoekt.",
      wanneer: "Na empathie tonen.",
      hoe: "Verbind je product/dienst aan de behoefte die je hebt geïdentificeerd.",
      voorbeeld: ["Daarom bieden wij ... aan, wat precies aansluit bij wat u zoekt."],
      stappenplan: [
        "Verwijs naar behoefte.",
        "Presenteer oplossing.",
        "Check reactie."
      ],
      tags: ["oplossing", "aanbod", "presentatie"]
    },
    "3.3": {
      nummer: "3.3",
      naam: "Voordeel benoemen",
      doel: "De baten voor de klant concreet en meetbaar maken.",
      fase: "3",
      parent: "3",
      wat: "Benoem expliciet het voordeel van je oplossing voor de klant.",
      waarom: "Klanten kopen voordelen, niet features.",
      wanneer: "Direct na presentatie van oplossing.",
      hoe: "Zeg wat het voordeel is van jouw oplossing ten opzichte van alternatief.",
      voorbeeld: ["Het voordeel hiervan is dat u geen onverwachte kosten hebt."],
      stappenplan: [
        "Benoem de feature.",
        "Vertaal naar voordeel.",
        "Check begrip."
      ],
      tags: ["voordeel", "USP", "waarde"]
    },
    "3.4": {
      nummer: "3.4",
      naam: "Baat vertalen",
      doel: "De klant helpen zich de toekomstige situatie met jouw oplossing voor te stellen.",
      fase: "3",
      parent: "3",
      wat: "Vertaal het voordeel naar een concreet resultaat voor de prospect.",
      waarom: "Klanten beslissen op basis van persoonlijke impact en baten.",
      wanneer: "Na benoemen van voordeel.",
      hoe: "Geef concreet aan wat de klant wint of voorkomt met jouw oplossing.",
      voorbeeld: ["Concreet betekent dat voor u, dat u niet opnieuw wakker hoeft te liggen van de kosten."],
      stappenplan: [
        "Kijk naar klantcontext.",
        "Vertaal voordeel naar klant-impact.",
        "Vraag daarna naar mening."
      ],
      tags: ["concreet", "impact", "klantgericht"]
    },
    "3.5": {
      nummer: "3.5",
      naam: "Mening vragen",
      doel: "Testen of de klant klaar is om te beslissen en eventuele bezwaren vroeg detecteren.",
      fase: "3",
      parent: "3",
      wat: "Peil naar de mening van de klant over je voorstel en lok een koopsignaal uit door de klant een keuze voor te stellen",
      waarom: "Je activeert klant en krijgt expliciete feedback.",
      wanneer: "Na uitleg van baat, als brug naar afsluiten.",
      hoe: "Stel een open of alternatieve mening-vraag: 'Wat vindt u daarvan? en volg op met: zou u dan eerder voor x of y kiezen'",
      voorbeeld: [
        "Wat vindt u van deze aanpak?",
        "Ziet u dat zitten?"
      ],
      stappenplan: [
        "Vraag mening na baat.",
        "Luister en vat samen.",
        "Check of klant klaar is."
      ],
      tags: ["mening", "alternatief", "klantactivering"]
    },
    "4.1": {
      nummer: "4.1",
      naam: "Proefafsluiting",
      doel: "Signalen van twijfel, bezwaar, uitstel of angst tijdig detecteren.",
      fase: "4",
      parent: "4",
      wat: "Een zachte test of de klant klaar is om te kopen door een instapvraag.",
      waarom: "Met een proefafsluiting test je of de klant mentaal klaar is voor de aankoop. Je spoort eventuele verborgen bezwaren op.",
      wanneer: "Wanneer je voelt dat de klant positief staat, maar nog niet expliciet 'ja' heeft gezegd.",
      hoe: "Je stelt een vraag die polst naar de bereidheid tot aankoop, zonder druk te zetten.",
      voorbeeld: [
        "Als u vandaag zou moeten kiezen, zou u eerder voor een blauwe of een groene kiezen?",
        "Indien u zou overgaan tot een aankoop, koopt u dan op naam van de kinderen of in eerste instantie op jullie eigen naam?",
        "Als u vandaag zou moeten kiezen, waar zou uw voorkeur naar uitgaan?"
      ],
      stappenplan: [
        "Stel een zachte testvraag.",
        "Observeer reactie.",
        "Ga terug naar vorige fases bij twijfel.",
        "Ga naar afsluiten bij akkoord."
      ],
      tags: ["proefafsluiting", "koopsignaal", "verkennend afsluiten"]
    },
    "4.2.1": {
      nummer: "4.2.1",
      naam: "Klant stelt vragen",
      doel: "Informatielacunes vullen zodat de klant geïnformeerd kan beslissen.",
      fase: "4",
      parent: "4.2",
      wat: "Correct reageren op klantvragen in de beslissingsfase.",
      waarom: "Om te achterhalen wat de klant écht wil weten en om in te spelen op koopintentie.",
      wanneer: "Elke keer een klant een vraag stelt tijdens fase 4.",
      hoe: "Volg het stappenplan afhankelijk van de situatie (meerdere opties vs. één optie).",
      voorbeeld: [
        "U vraagt naar de garantie: bedoelt u garantie op onderdelen of op afwerking?",
        "Als u vandaag zou moeten kiezen tussen deze twee opties, wat zou het dan worden?"
      ],
      stappenplan: [
        "Bij meerdere opties: gebruik pingpongtechniek.",
        "Bij één optie: geef antwoord, vraag mening/commitment/proefafsluiting.",
        "Nooit terzijde schuiven in deze fase."
      ],
      tags: ["vragen", "beslissingsfase", "pingpong", "commitment"]
    },
    "4.2.2": {
      nummer: "4.2.2",
      naam: "Twijfels behandelen",
      doel: "De klant helpen zijn onzekerheid te overwinnen.",
      fase: "4",
      parent: "4.2",
      wat: "Omgaan met twijfels van de klant in de beslissingsfase.",
      waarom: "Om onderliggende bezwaren te ontdekken en commitment te verkrijgen.",
      wanneer: "Zodra klant twijfelt of twijfels uit.",
      hoe: "EERST bepalen: is dit een OPRECHTE twijfel (slechte ervaringen, onzekerheid) of een VERDOKEN BEZWAAR? Dan pas behandelen.",
      voorbeeld: [
        "Kunt u mij toelichten waar u precies over twijfelt?",
        "Komt deze twijfel voort uit eerdere ervaringen, of speelt er iets anders?",
        "Als we dat punt kunnen aantonen, zou u dan kunnen afronden?"
      ],
      stappenplan: [
        "Check: Is dit een OPRECHTE twijfel of een VERDOKEN BEZWAAR?",
        "Bij oprechte twijfel (slechte ervaringen): Wedervraag 'Kunt u mij toelichten waar u over twijfelt?'",
        "Commitment: 'Als ik dit punt kan aantonen, zou u dan kunnen beslissen?'",
        "Bewijsvoering: Onderbouwen met externe referenties, cijfers, of testimonials.",
        "Bij verdoken bezwaar: Doorverwijzen naar 4.2.4 Bezwaren behandelen.",
        "Afsluiten: Proefafsluiting of definitieve afsluiting."
      ],
      tags: ["twijfel", "beslissingsfase", "commitment", "bewijsvoering", "oprecht", "verdoken"]
    },
    "4.2.3": {
      nummer: "4.2.3",
      naam: "Uitstel behandelen",
      doel: "Urgentie creëren en redenen voor uitstellen wegnemen.",
      fase: "4",
      parent: "4.2",
      wat: "Omgaan met uitstelgedrag in de beslissingsfase. Klant zit op 11 uur buying clock, moet naar 12 uur.",
      waarom: "Om alsnog een beslissing af te dwingen en de échte reden voor uitstel te achterhalen.",
      wanneer: "Wanneer klant zegt: 'Ik moet nadenken', 'Ik moet dit bespreken', 'Stuur eerst een offerte', etc.",
      hoe: "EERST bepalen: is dit een VOORWAARDE (echt nodig) of een VOORWENDSEL (excuus voor onderliggend bezwaar/angst)?",
      voorbeeld: [
        "Ik begrijp dat u dit wil bespreken. Is dat omdat u nog informatie mist, of speelt er iets anders?",
        "Als u het zou moeten bespreken, wat denkt u dat het antwoord zou zijn?",
        "Stel dat uw partner akkoord gaat, zou u dan vandaag kunnen beslissen?"
      ],
      stappenplan: [
        "Check: Is dit een VOORWAARDE of een VOORWENDSEL?",
        "Bij voorwaarde (echt nodig): Empathie tonen en Action Plan maken.",
        "Bij voorwendsel (excuus): Doorvragen 'Onafgezien [uitstelreden], wat zou u beslissing zijn?'",
        "Analyseren: 'Wat houdt u eigenlijk tegen?' - zoek onderliggende angst of bezwaar.",
        "Bij onderliggend bezwaar: Doorverwijzen naar 4.2.4 Bezwaren behandelen.",
        "Bij onderliggende angst: Doorverwijzen naar 4.2.5 Angst behandelen.",
        "Action Plan: Maak concrete follow-up met datum, tijd en wie wat doet."
      ],
      tags: ["uitstel", "beslissingsfase", "actieplan", "empathie", "voorwaarde", "voorwendsel"]
    },
    "4.2.4": {
      nummer: "4.2.4",
      naam: "Bezwaren behandelen",
      doel: "Concrete bezwaren ombuigen of weerleggen.",
      fase: "4",
      parent: "4.2",
      wat: "Omgaan met bezwaren in de beslissingsfase. Een bezwaar = ontdekt nadeel van klant omtrent eigenschap van jouw oplossing. Een bezwaar is een KOOPSIGNAAL: 'an objection is not a rejection, but an opportunity to clarify value.'",
      waarom: "Om bezwaren te neutraliseren en toch tot afsluiting te komen door baten te maximaliseren en bezwaar te minimaliseren.",
      wanneer: "Wanneer klant expliciet bezwaar maakt (te duur, verkeerde specs, te lang, etc.).",
      hoe: "EPIC-vragen + Pencil Selling + Afweegtechniek. Maximaliseer baten, minimaliseer bezwaar.",
      voorbeeld: [
        "U zegt te duur. Tegenover wie? Tegenover wat? Hoeveel precies?",
        "Als ik u goed begrijp, is het dus ENKEL een kwestie van budget dat u weerhoudt?",
        "Onafgezien budget, naar waar zou uw voorkeur uitgaan? Naar ons of naar concurrent X?",
        "Wat betekent het voor u om [baat A, B, C] wel/niet te hebben gedurende 10 jaar?",
        "€12.000 over 10 jaar = €100 per maand. Weegt dat op tegen [gemaximaliseerde baten]?"
      ],
      stappenplan: [
        "Empathie: 'Ik begrijp dat dit belangrijk voor u is.'",
        "EPIC Analyseren: 'Tegenover wie? Tegenover wat? Hoeveel precies? Over welke periode?'",
        "Isoleren: 'Als ik u goed begrijp, is het dus ENKEL een kwestie van [bezwaar] dat u weerhoudt?'",
        "Neutraliseren: 'Onafgezien [bezwaar], naar waar zou uw voorkeur uitgaan? Waarom?'",
        "Maximaliseren (Pencil Selling): 'Wat betekent [baat A, B, C] voor u?' - voor promotors: verwerven, voor analyseerders: vermijden.",
        "Minimaliseren (Afweegtechniek): Bereken bezwaar per maand/jaar. 'Weegt €X per maand op tegen [baten]?'",
        "Afsluiten: Ga terug naar proefafsluiting of indien-techniek."
      ],
      tags: ["bezwaren", "beslissingsfase", "commitment", "bewijsvoering", "pencil selling", "afweegtechniek", "koopsignaal"]
    },
    "4.2.5": {
      nummer: "4.2.5",
      naam: "Angst / Bezorgdheden",
      doel: "Emotionele blokkades overwinnen door risico's te minimaliseren.",
      fase: "4",
      parent: "4.2",
      wat: "Omgaan met angst en bezorgdheden in de beslissingsfase.",
      waarom: "Om onderliggende emoties te adresseren en de klant gerust te stellen met bewijs en perspectief.",
      wanneer: "Wanneer klant zorgen of angsten uit over de beslissing.",
      hoe: "Referentieverhaal, Pro & Contra techniek, Up and Down Stairs techniek.",
      voorbeeld: [
        "Ik begrijp uw bezorgdheid. Mag ik u een verhaal vertellen van een andere klant?",
        "Laten we de voor- en nadelen eens op een rijtje zetten."
      ],
      stappenplan: [
        "Referentie Story: Deel een vergelijkbaar succesverhaal van een andere klant.",
        "Pro & Contra techniek: Zet voordelen en nadelen samen op een rijtje.",
        "Up and Down Stairs techniek: Laat klant scenario's zien van wel/niet beslissen."
      ],
      tags: ["bezorgdheid", "angst", "beslissingsfase", "referentieverhaal"]
    }
  }
} as const;

export default technieken_index;
