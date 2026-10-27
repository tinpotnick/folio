> Research note for the "known sources" decision (docs/specs/data-import.md, ADR-0029).
> Licences change: re-check a provider's own terms before building it. Compiled with an AI research agent from the providers' published terms; quotes link their sources.

# Public data sources for folio "known source" import: licence and access audit

Checked 2026-10-27. Probes used curl with an honest UA (`folio-probe/0.1`) and `Origin: https://example.org`. "ACAO" means the response carried `Access-Control-Allow-Origin`. Quotes come from the provider's own page. Where WebFetch was blocked (403), the quote is the search-engine extract of that same first-party URL, and is marked †.

## (a) Summary table

| Provider | Relevant data (example code / URL pattern) | Licence | Shareable in a public doc? | Key? | Plain GET | Official? |
|---|---|---|---|---|---|---|
| Bank of England IADB | Bank Rate `IUMBEDR`; 2y fixed 75% LTV `IUMBV34`; 5y fixed `IUMBV42`; revert-to rate (SVR) `IUMTLMV`; 10y gilt nominal zero-coupon yield `IUMAMNZC`. `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/2020&Dateto=now&SeriesCodes=IUMBEDR,IUMBV34&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N` (`CSVF=TT` adds descriptions) | OGL v3 (excludes some third-party FX series) | **Yes, with attribution** | No | Yes, 200 `application/csv`; **no ACAO** | Official (a URL interface, not a versioned API) |
| ONS | CPI annual rate `D7G7`/`MM23`, CPIH `L55O`. CSV: `https://www.ons.gov.uk/generator?format=csv&uri=/economy/inflationandpriceindices/timeseries/d7g7/mm23`; JSON: `.../timeseries/d7g7/mm23/data`; API: `https://api.beta.ons.gov.uk/v1/datasets/cpih01` | OGL v3 | **Yes, with attribution** | No | Yes. Generator: no ACAO. `/data` JSON and API: ACAO `*` | Official. The API is "beta". The `/data` JSON is a website endpoint |
| OECD SDMX | UK share price index (monthly, 2015=100): `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/GBR.M.SHARE......?startPeriod=2000-01&format=csvfilewithlabels`; CPI and long-term rates in the same family | CC BY 4.0† | **Yes, with attribution** (OECD citation format) | No | Yes, ACAO echoed | Official |
| FRED | `SPASTT01GBM661N` (the same OECD series, re-hosted). `https://api.stlouisfed.org/fred/series/observations?series_id=…&api_key=…&file_type=json` | FRED terms. This series is flagged "copyrighted" (OECD) | Unclear via FRED. Go to OECD directly | API: yes | `fredgraph.csv` hung/reset for a non-browser client. The API answered 400 without a key | Official API |
| HM Land Registry UK HPI | `https://landregistry.data.gov.uk/app/ukhpi/download/new.csv?from=2020-01-01&to=2024-01-01&location=http%3A%2F%2Flandregistry.data.gov.uk%2Fid%2Fregion%2Funited-kingdom` (also `.json`); monthly bulk CSVs on publicdata.landregistry.gov.uk | OGL v3 | **Yes, with attribution** | No | Yes; no ACAO | Official |
| UK DMO | Gilts in issue, gilt prices/yields reports | OGL (Crown copyright)† | Yes, with attribution (licence-wise) | No | **Partly blocked**: XML report 302 to a ShieldSquare bot challenge | Official, but bot-protected. Use BoE yields instead |
| ECB Data Portal | `https://data-api.ecb.europa.eu/service/data/EXR/D.GBP.EUR.SP00.A?format=csvdata` | Free reuse with source credit | **Yes, with attribution** | No | Yes, ACAO `*` | Official |
| Eurostat | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?geo=…` | CC BY 4.0 | **Yes, with attribution** (little UK data after 2020) | No | Yes, ACAO `*` | Official |
| Alpha Vantage | `TIME_SERIES_DAILY&symbol=…&apikey=…` | Personal, non-commercial licence | **No** (personal use) | Yes; 25 req/day | Yes, ACAO `*` | Official commercial API |
| Twelve Data | `/time_series?symbol=…&interval=1day&apikey=…` | Internal use; redistribution needs an add-on | **No** | Yes; 8/min, 800/day | Yes, ACAO `*` | Official |
| Financial Modeling Prep | `/stable/historical-price-eod/full?symbol=…&apikey=…` | Personal; display needs an agreement† | **No** | Yes; 250/day† | 401 without a key; ACAO `*` | Official |
| Tiingo | `/tiingo/daily/<t>/prices?token=…` | Personal/internal only† | **No** | Yes | 403 without a token | Official |
| EODHD | `/api/eod/VUKG.LSE?api_token=…` | Non-professional personal use | **No** | Yes (the `demo` key covers only a few US tickers) | 200 for AAPL demo; 403 for VUKG | Official |
| Marketstack | `/v2/eod?symbols=…&access_key=…` | Terms page redirects to APILayer legal index; terms not read | Unclear (treat as no) | Yes | 401 without a key; ACAO `*` | Official |
| Nasdaq Data Link | `/api/v3/datasets/<code>.csv` | Terms page content not retrievable | Unclear; depends on the dataset | Yes (free key) | **No**: 403 HTML bot/JS page | Official |
| Yahoo Finance | `query1.finance.yahoo.com/v8/finance/chart/VUKG.L` | Yahoo ToS | **No** | No | Yes (200 JSON, no ACAO) | **Unofficial** |
| Google Finance | GOOGLEFINANCE in Sheets | Disclaimer forbids download/redistribution | **No**. Historical data cannot be exported | — | — | No API |
| FTSE Russell (LSEG) | FTSE 100 levels / TR | Licence required | **No** without a licence | — | — | — |
| Vanguard UK | VUKG / FTSE 100 Index Unit Trust pages | Personal, non-commercial | **No** | — | JS app; no documented download | — |
| iShares (BlackRock) | ISF fund page `.ajax?fileType=xls…` download | Personal, internal use only | **No** | — | 403 Akamai "Access Denied" | Unofficial |
| MSCI | MSCI World / ACWI levels | Personal, informational use | **No** | — | (not probed) | — |

## Licence quotes

- **BoE** (https://www.bankofengland.co.uk/legal): "Reproduction of data in the Database is subject to the terms of the UK Open Government Licence". Third-party exclusion: "selected exchange rate data and series are excluded from this licence as they are reproduced by the Bank under licence from third parties." Attribution: the OGL v3 pattern "Contains public sector information licensed under the Open Government Licence v3.0." plus "Source: Bank of England".
- **ONS** (https://www.ons.gov.uk/methodology/geography/licences): "you may do so freely without a specific application for a licence, subject to the conditions of the Open Government Licence". Required attribution: "Source: Office for National Statistics licensed under the Open Government Licence v.3.0".
- **OECD**† (https://www.oecd.org/en/about/terms-conditions.html; returned 403 to direct fetch): "you can extract from, download, copy, adapt, print, distribute, share and embed Data for any purpose, even for commercial use. However, you must give appropriate credit to the OECD … OECD (year), (dataset name),(data source) DOI or URL (accessed on (date))."
- **FRED** (https://fred.stlouisfed.org/legal/): "BEFORE USING DATA SERIES OWNED BY THIRD PARTIES FOR ANYTHING OTHER THAN YOUR OWN PERSONAL USE, YOU MUST CONTACT THE DATA OWNER TO OBTAIN PERMISSION." The SPASTT01GBM661N page says: "Data in this graph are copyrighted. Please review the copyright information in the series notes before sharing."
- **Land Registry UK HPI** (gov.uk UK HPI downloads page): "All content is available under the Open Government Licence v3.0, except where otherwise stated".
- **DMO**† (https://dmo.gov.uk/terms-of-use; the direct fetch hit a bot challenge): "You may use and re-use the information featured on this website (not including logos) free of charge in any format or medium, under the terms of the Open Government Licence."
- **ECB** (statistics usage policy page): "free access and free reuse", provided the "source is quoted (e.g. 'Source: ECB statistics.')", and statistics must not be modified.
- **Eurostat / EC** (https://commission.europa.eu/legal-notice_en): "content owned by the EU on this website is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence."
- **Alpha Vantage** (https://www.alphavantage.co/terms_of_service/ PDF, §2a): "for personal, non-commercial use". "Commercial use" includes "use or provide information accessed through the Alpha Vantage Platform as part of any type of commercial activity that allows individuals or entities other than User to access information". A free public share is not plainly "commercial". Even so, the licence covers personal use only. Verdict: **no**.
- **Twelve Data** (https://twelvedata.com/terms §2.2(e)): "Redistribute or provide external display of Data only if and as expressly authorized by a Redistribution Rights Add-On or separate written agreement".
- **FMP**† (FMP's own article "Can You Use FMP Data in a Public App or Website?"): "Individual plans don't allow the display or distributing of the data to end users or the public."
- **Tiingo**† (https://app.tiingo.com/tos/): "internal use means you may only use the data for your own personal use and you may not display or share the data with another person or organization."
- **EODHD** (https://eodhd.com/financial-apis/terms-conditions): non-professional users may not engage in "Selling, reselling, retransmitting, redistributing, displaying, or granting access to the Information".
- **Yahoo** (https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html): "you must not reproduce, modify, … distribute, transmit … any portion" and must not "access or collect data … using any automated means".
- **Google Finance** (https://www.google.com/googlefinance/disclaimer/): "You agree not to copy, modify, reformat, download, store, reproduce, reprocess, transmit or redistribute any data". Sheets help (support.google.com/docs/answer/3093281): "Historical data cannot be downloaded or accessed via the Sheets API or Apps Script."
- **FTSE Russell**: the standard LSEG notice on FTSE-index factsheets reads "No further distribution of data from the LSE Group is permitted without the relevant LSE Group company's express written consent." The LSEG attribution document is written for parties who already hold a licence: "Where you have been licensed by FTSE to include FTSE data in any reports…".
- **Vanguard** (https://www.vanguard.co.uk/uk-fund-directory/terms-and-conditions): "solely for your personal, informational, and noncommercial use". Users may not "distribute … post, display … reproduce, publish … any reports, data, information … obtained from this website".
- **iShares** (https://www.ishares.com/uk/individual/en/compliance/terms-and-conditions): "you may not sell, copy, publish, distribute … display, reproduce … the information or software on this website."
- **MSCI** (https://www.msci.com/terms-of-use-and-disclaimer): "Reproduction, redistribution or any other form of copying or transmission of the Index Data without IPD's prior written consent is strictly prohibited." The page says "IPD", which is MSCI's property-index unit. The general MSCI index terms read the same way.

## (b) Recommendation

**Build as known sources, safe to share:**
1. **BoE IADB**: Bank Rate, quoted mortgage rates, gilt yields.
2. **ONS**: CPI and CPIH.
3. **OECD SDMX**: UK share price index, plus CPI and long rates for international comparison.
4. **HM Land Registry UK HPI**.
5. Optionally **ECB** and **Eurostat**.

All of these are OGL v3 or CC BY 4.0. Store in the citation: publisher, dataset or series code, URL, access date, and the licence's exact attribution string.

Notes on fetching them:
- BoE, the ONS generator and Land Registry send **no CORS header**. The web host needs a fetch proxy or must use the JSON endpoints that do send ACAO (ONS `/data`, OECD, ECB, Eurostat). The desktop app can fetch them directly.
- Prefer OECD direct over FRED: OECD's own CC BY terms apply there, whereas FRED's "copyrighted" flag adds uncertainty.
- Skip DMO; it sits behind bot protection.

**Personal use only, with a "not for sharing" warning** (key-based, with documented APIs): Alpha Vantage, Twelve Data, FMP, Tiingo, EODHD. The import should taint the table with a `licence: personal-use` flag. The share/export flow should then warn, or offer to replace the raw rows with derived results only. Note that their terms also restrict derived *display*, so the warning should not claim derived results are safe. Marketstack and Nasdaq Data Link: leave out unless their terms are confirmed.

**Exclude:**
- Yahoo: unofficial endpoint, and the ToS forbids automated collection.
- Google Finance: no export.
- iShares and Vanguard pages: personal use only, and in practice they are scrape-only.
- FTSE Russell and MSCI: licence required.
- Stooq: JS bot challenge; terms not checked.
- DMO: bot challenge.
- FRED `fredgraph.csv`: not built, because it hung for a non-browser client. Use OECD instead.

## (c) FTSE 100 tracker total-return history under a sharing licence

**No source found that is both a FTSE 100 total-return series and licensed for public sharing.** FTSE 100 levels and TR are LSEG-licensed. Fund prices (VUKG, ISF, the Vanguard unit trust) are covered by personal-use website terms. Every commercial API forbids redistribution on its free tier.

The realistic shareable route:
1. Use **OECD UK share prices** (CC BY 4.0, monthly, price-only). This is a broad UK equity index, not the FTSE 100. Which underlying index OECD uses was not verified (the "National" methodology code gives no name).
2. Add an **explicit, user-stated dividend/return assumption**, e.g. "assume 3.5% dividend yield reinvested", as a formula column. The document then shows a *modelled* total return, and the assumption is visible.

Alternatively, the user can type in their own fund's annual returns from their statement, or fetch tracker prices from a personal-use API. Either way, the table should be flagged as not for public sharing.

The BoE "Millennium of macroeconomic data" spreadsheet may hold annual UK equity total returns, but I did not verify its licence or third-party carve-outs. It would need checking before relying on it.
