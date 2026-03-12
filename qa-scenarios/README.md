# QA Scenarios

Elk bestand in deze map beschrijft interactieve states van een pagina die getest moeten worden.

## Gebruik

```bash
node visual-qa.mjs --scenario=qa-scenarios/dashboard.json
```

## Formaat

```json
{
  "name": "Naam van de pagina/component",
  "url": "http://localhost:5001/pagina",
  "scenarios": [
    {
      "name": "default state",
      "actions": []
    },
    {
      "name": "popup open",
      "actions": [
        { "type": "click", "selector": "[aria-label='Notificaties']" },
        { "type": "waitForSelector", "selector": "[role='dialog']" }
      ]
    }
  ]
}
```

## Action types

| Type | Vereist | Optioneel |
|------|---------|-----------|
| `click` | `selector` | — |
| `hover` | `selector` | — |
| `wait` | — | `ms` (default: 500) |
| `waitForSelector` | `selector` | — |
| `type` | `selector`, `value` | — |

## Wanneer een scenario aanmaken?

**Als onderdeel van de feature** — niet achteraf. Bij elke UI-wijziging die popups, modals, dropdowns, of andere interactieve states introduceert, schrijft de agent ook het bijbehorende scenario-bestand.
