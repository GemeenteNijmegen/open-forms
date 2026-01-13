import { Construct } from 'constructs';

export interface ReceiverMonitoringProps {
  logLevel: string;
  stepFunctionArn: string;
}

export class ReceiverMonitoring extends Construct {
  constructor(scope: Construct, id: string, private props: ReceiverMonitoringProps) {
    super(scope, id);
  }

  // Met Rule aanroepen lambda, Iedere nacht draaien. Check of objects api van die dag overeen komt met ListExecutions van de Step Function van die dag
  // Indien een object van die dag niet voorkomt in de listexecutions met success, dan moet er een alarm afgaan of een slack bericht gestuurd worden

  // Objects api hergebruik van api key secret parameter die nu in submissionForwarder aangemaakt wordt
  // Maar die secret is nodig in de stack

  // ZgwClientFactory alleen te gebruiken met objects? Anders nog andere params


  // Zorgen dat de function een langere timeout heeft om alle calls te kunnen doen

  //   const sm = StateMachine.fromStateMachineArn(
  //   this,
  //   'naam',
  //   this.stepFunctionArn,
  // );

  // sm.grantRead(lambdaFn);

}