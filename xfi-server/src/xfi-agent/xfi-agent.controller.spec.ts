import { Test, TestingModule } from '@nestjs/testing';
import { XfiAgentController } from './xfi-agent.controller';

describe('XfiAgentController', () => {
  let controller: XfiAgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [XfiAgentController],
    }).compile();

    controller = module.get<XfiAgentController>(XfiAgentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
