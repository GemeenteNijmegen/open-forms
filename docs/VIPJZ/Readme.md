# VIPJZ
src/submission-forwarder/vip-transformation-lambda

Solution to process submission with a VIP or JZ destination until the more robust implemenation will be delivered.

### Form definition based
The submission should contain:
- bsn or kvknummer outside data
- appId - APV or JUR
- all fields that have a vip_key, jz4all_key or dms_key property in form definition
- vipZaakTypes
- inloggmiddel `digid` or `eherkenning` or `irma` (tested)

All form definitions fields that have a vip/jz4all/dms key have been mapped to an object to make sure they have the exact same name as the fields in the form definition.
At first the form definition will be obtained from the old form io environment. The form definitions will be moved to a new endpoint later on.
