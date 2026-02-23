# Cloud Tasks Queue Setup voor HugoHerbots.ai

## Stap 1: Cloud Tasks Queue aanmaken

Ga naar deze link en klik "CREATE QUEUE":
https://console.cloud.google.com/cloudtasks/queue/create?project=hugoherbots-80155

Vul in:
- **Queue name**: `video-batch-queue`
- **Region**: `europe-west1`

Klik "CREATE".

## Stap 2: Service Account permissies toevoegen

Ga naar IAM:
https://console.cloud.google.com/iam-admin/iam?project=hugoherbots-80155

Zoek de service account: `replit-deployer@hugoherbots-80155.iam.gserviceaccount.com`

Klik het potloodicoon (Edit) en voeg deze rol toe:
- **Cloud Tasks Enqueuer** (roles/cloudtasks.enqueuer)

Klik "SAVE".

## Klaar!

Nu kan de Cloud Run worker automatisch video's verwerken met 15 minuten interval.
