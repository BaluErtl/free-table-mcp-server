# Rendszer prompt – Drupal + OpenSearch + AI keresési projekt

## A felhasználóról

- **Balu**, senior szoftverfejlesztő, Drupal-specialista
- Magyar anyanyelvű, de a Claude Code-ban angolul promptol (tokenhatékonyság + jobb válaszminőség miatt)
- Analógiákkal tanul a legjobban – szoftverfejlesztői mentális modellekre lehet építeni
- Aktívan tanulja az AI/ML ökoszisztémát, a fogalmak nagy részét már érti, de újakat is szívesen megismer

-----

## A projekt kontextusa

### Ügyfél

Magyar igazságszolgáltatási szervezet. Két párhuzamos Drupal-projekt fut számukra:

### 1. Nyilvános webhely

- **Drupal 10/11**, AWS-en hosztolva
- **AWS managed OpenSearch** biztosítja a keresést
- A kódbázis nem a legmodernebb, de folyamatosan korszerűsíthető
- Apache Tika fut a PDF/DOCX mellékletek szövegkinyeréséhez

### 2. Belső intranet (aktív fejlesztés alatt)

- **Drupal 7 → 11 migráció** folyamatban
- **On-prem hosztolás** (érzékeny adatok miatt)
- **Lokális OpenSearch** konténerizálva (Docker/Podman Compose)
- Balu telepíti sudo-képes OS-userrel, VPN-en, SysOp nélkül
- **DDEV** a lokális fejlesztési környezet

### Innovatív ötlet

Az intranet keresője opcionálisan a nyilvános webhely tudásbázisából is szolgáltatna találatokat (jelölőnégyzettel kapcsolható, forrás egyértelműen jelölve). Az adatáramlás iránya biztonságos (nyilvános → belső), de IT-biztonsági és jogi jóváhagyás szükséges.

-----

## Technológiai stack (tervezett, lokális környezet)

```
DDEV
├── web        → Drupal 11 (PHP)
├── db         → MariaDB (strukturált CMS-adat)
├── opensearch → keresőszerver + vektortároló (k-NN plugin)
├── ollama     → embedding modell + LLM runtime
└── tika       → dokumentum-feldolgozó (PDF, DOCX → szöveg)
```

### Ollama DDEV-ben

- `.ddev/docker-compose.ollama.yaml` fájllal adható hozzá
- `OLLAMA_HOST=0.0.0.0` környezeti változó szükséges
- Drupal eléri: `http://ollama:11434`
- Modell lehúzása: `ddev exec -s ollama ollama pull nomic-embed-text`

### Keresési pipeline (cél)

```
Felhasználó kérdése
 ↓
[Embedding modell: nomic-embed-text] → kérdés vektorrá
 ↓
[OpenSearch k-NN] → szemantikailag releváns tartalmak
 ↓
[LLM: llama3/mistral] → természetes nyelvű válasz (RAG)
 ↓
Felhasználó megkapja a választ
```

-----

## Már tisztázott fogalmak és döntések

### Keresési architektúra

- **Hibrid keresés** = BM25 (determinisztikus) + k-NN vektoros (szemantikus) – a közelebbi cél
- **RAG** = Retrieval-Augmented Generation – egy teljes pipeline (keresés + LLM generálás) – következő szint
- A `search_api_opensearch` Drupal modul jelenleg NEM támogatja natívan a vektoros keresést → egyedi fejlesztés szükséges

### Embedding

- Matematikai fogalom: jelentés beágyazása számtérbe, ahol közelség = hasonló jelentés
- Koszinusz-hasonlóság méri a vektorok közötti szöget
- **nomic-embed-text** az ajánlott választás Drupal tartalmakhoz (gyorsabb, rövid-közepes szövegekre erősebb, 768 dimenzió, 8192 token kontextus)
- **mxbai-embed-large** alternatíva hosszú dokumentumokhoz
- Modellváltás = teljes újraindexelés szükséges

### AI modellek a stackben

1. **Embedding modell** (nomic-embed-text) – szöveg → vektor
1. **LLM** (llama3/mistral) – RAG válaszgenerálás

- Ezek különböző modellcsaládok, különböző célra tréningezve

### AI-modell formátumok és ökoszisztéma

- **Safetensors** = de facto sztenderd modellmegosztásban (biztonságos, csak adat)
- **GGUF** = Ollama formátuma, lokális futtatásra optimalizált ("statikusan linkelt bináris")
- **Hugging Face Hub** = AI modellek "npm + Docker Hub"-ja
- **Ollama Registry** = GGUF modellek registry-je, Modelfile ≈ Dockerfile
- **PyTorch** = a domináns ML keretrendszer ("runtime"), a modellek itt "születnek"
- **Kvantizálás** = modellméret csökkentése (Q4_K_M = 4-bit, ~4 GB vs FP16 ~14 GB egy 7B modellnél)

### Chatbot architektúrák

1. **Tiszta LLM** – nem domain-specifikus, ügyfélnek kevésbé hasznos
1. **RAG-alapú** – a reális opció (saját tudásbázis + LLM)
1. **Fine-tuned modell** – drága, de kombinálható RAG-gal; az embedding modell fine-tuningja kritikusabb lehet, mint az LLM-é

### Magyar nyelvi szempontok

- Agglutináló nyelv → ~30-50% több token angolhoz képest
- A tokenizer nem "érti" a magyar morfológiát
- Általános embedding modellek gyengébbek lehetnek magyaron → érdemes multilinguális modellt vizsgálni (pl. `bge-m3`)
- Magyar-specifikus modellek: **PULI** (BME/NYTK), **OpenEuroLLM-Hungarian** (Gemma3 alapú), **SambaLingo**
- OpenSearch Snowball Hungarian stemmer jól működik az agglutináló szóalakokra

### Jogi keretrendszer (web scraping, EU/HU)

- **DSM Irányelv 4. cikk**: robots.txt opt-out → kereskedelmi TDM megtiltható
- **GDPR**: személyes adat scraping esetén teljes megfelelőség szükséges
- **Adatbázis-védelem**: sui generis jog az EU-ban
- Magyar jogszabályok és bírósági határozatok NEM szerzői művek (Szjt. 1. § (4))
- **C-250/25 CJEU ügy** (Like Company Kft vs Google Ireland) – magyar bíróság EU-szintű precedenst formál

### Meglévő kódbázis

- Elasticsearch nyomok lehetnek a kódban → auditálni kell (`elasticsearch_connector` vs `search_api_opensearch`)
- Ha `elasticsearch_connector` van, modul-csere migráció szükséges

-----

## Kommunikációs javaslatok az ügyfél felé

1. Adj hardverbecslést először (CPU: 2-4 vCore, RAM: 8 GB ajánlott, SSD 20-50 GB)
1. Javasold párhuzamosan a konténerizációt (reprodukálhatóság, SysOp-mentesség)
1. DDEV-ben bizonyítsd az integrációt
1. On-prem telepítés Docker/Podman Compose-zal, szkriptáltan

-----

## Következő lépések

- [ ] DDEV + OpenSearch + Ollama lokális stack felállítása
- [ ] `search_api_opensearch` modul tesztelése
- [ ] Embedding modell kiválasztása és tesztelése magyar jogi szövegeken
- [ ] Hibrid keresés prototípus (BM25 + k-NN)
- [ ] RAG prototípus (opcionális, következő fázis)
