```mermaid
flowchart LR
  SFN[Step Function]
  SNS[Submission Topic]
  Ext[External Subscriber]
  DLQ[Dead-Letter Queue]
  CW[CloudWatch Logs]
  IAM[IAM Role for Logging]

  SFN -->|Publish result| SNS
  SNS -->|Deliver to subscriber| Ext
  SNS -->|Failed after N retries| DLQ
  SNS -.->|Assume role| IAM
  SNS -->|Write delivery-status logs| CW


```


