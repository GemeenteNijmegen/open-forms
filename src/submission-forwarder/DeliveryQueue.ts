import { Criticality, DeadLetterQueue } from "@gemeentenijmegen/aws-constructs";
import { Role } from "aws-cdk-lib/aws-iam";
import { IKey } from "aws-cdk-lib/aws-kms";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

interface DeliveryQeueProps {
  /**
   * Required: Encryption key for messages.
   */
  key: IKey,
  /**
   * Role which needs to be able to receive messages. Role will also get the ability to
   * put messages on the DLQ. Access to the KMS key is **NOT** granted in this construct.
   */
  role: Role,
  /**
   * Optional: Set a lower criticality (default critical)
   */
  criticality?: Criticality,
  /**
   * Optional: By default we use a fifo queue. Set to false for a regular queue.
   */
  fifo?: boolean;
}

/**
 * Create a queue with DLQ for a receiving system
 * 
 * By default it creates a FIFO queue with DLQ and alarms with priority critical
 */
export class DeliveryQueue extends Construct {
  public queue: Queue;
  private dlq: Queue;
  constructor(scope: Construct, id: string, props: DeliveryQeueProps) {
    super(scope, id);
    this.queue = this.createQueueWithDLQ({ key: props.key, fifo: props.fifo == true });
    this.queue.grantConsumeMessages(props.role);
    this.dlq.grantSendMessages(props.role);
  }

  private createQueueWithDLQ(options: {
      key: IKey, 
      alarmCriticality?: Criticality,
      fifo: boolean
    }) {
      const {key, alarmCriticality, fifo} = options;
      const dlq = new DeadLetterQueue(this, 'esb-dead-letter-queue', {
        alarmDescription: 'ESB Dead letter queue not empty',
        alarmCriticality,
        queueOptions: {
          fifo,
        },
        kmsKey: key,
      });
      this.dlq = dlq.dlq;

      return new Queue(this, 'esb-queue', {
        fifo,
        encryption: QueueEncryption.KMS,
        encryptionMasterKey: key,
        deadLetterQueue: {
          queue: this.dlq,
          maxReceiveCount: 3,
        },
      });
    }
  
}
