import { Body, Controller, Post } from '@nestjs/common';
import { XfiAgentService } from './xfi-agent.service';

@Controller('xfi-agent')
export class XfiAgentController {
  constructor(private readonly agentService: XfiAgentService) {}

  @Post()
  quote(@Body() payload: { prompt: string }) {
    const privateKeyEVM = '0x**'; // add privateKey here
    return this.agentService.BaseAgent(privateKeyEVM, payload.prompt);
  }
}
