import { describe, it, expect, beforeEach } from 'vitest';
import {
  Client,
  Provider,
  ProviderRegistry,
  Result,
  Receipt,
} from '@stacks/transactions';
import { principalCV, uintCV, stringAsciiCV, listCV, trueCV, falseCV } from '@stacks/transactions/dist/clarity/types/principalCV';

// Mock contract deployment details
const CONTRACT_NAME = 'opensource-dao';
const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const DEPLOYER_ADDRESS = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';

// Helper function to create a new client instance
const createClient = () => {
  const provider = new Provider({
    node: 'http://localhost:20443'
  });
  return new Client(provider);
};

describe('Open Source DAO Contract Tests', () => {
  let client: Client;
  
  beforeEach(() => {
    client = createClient();
  });
  
  describe('Governance Token Functions', () => {
    it('should mint governance tokens successfully', async () => {
      const amount = uintCV(1000);
      const recipient = principalCV(DEPLOYER_ADDRESS);
      
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'mint-governance-tokens',
        functionArgs: [amount, recipient],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      expect(receipt.success).toBe(true);
      
      // Verify balance
      const balanceReceipt = await client.callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-token-balance',
        functionArgs: [recipient],
      });
      
      expect(balanceReceipt.value).toEqual(amount);
    });
    
    it('should fail minting tokens from non-owner', async () => {
      const amount = uintCV(1000);
      const recipient = principalCV(DEPLOYER_ADDRESS);
      const nonOwner = 'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ';
      
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'mint-governance-tokens',
        functionArgs: [amount, recipient],
        senderAddress: nonOwner,
      });
      
      expect(receipt.success).toBe(false);
      expect(receipt.error).toEqual('ERR-NOT-AUTHORIZED');
    });
  });
  
  describe('Proposal Management', () => {
    it('should submit proposal successfully', async () => {
      const title = stringAsciiCV('Test Proposal');
      const description = stringAsciiCV('Test Description');
      const amount = uintCV(5000);
      const milestones = listCV([
        stringAsciiCV('Milestone 1'),
        stringAsciiCV('Milestone 2')
      ]);
      const milestoneAmounts = listCV([
        uintCV(2500),
        uintCV(2500)
      ]);
      
      // First mint some tokens to the proposer
      await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'mint-governance-tokens',
        functionArgs: [uintCV(2000), principalCV(DEPLOYER_ADDRESS)],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'submit-proposal',
        functionArgs: [title, description, amount, milestones, milestoneAmounts],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      expect(receipt.success).toBe(true);
      
      // Verify proposal was created
      const proposalReceipt = await client.callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-proposal',
        functionArgs: [uintCV(1)],
      });
      
      const proposal = proposalReceipt.value;
      expect(proposal.value.title).toEqual(title);
      expect(proposal.value.amount).toEqual(amount);
    });
    
    it('should fail proposal submission with insufficient tokens', async () => {
      const title = stringAsciiCV('Test Proposal');
      const description = stringAsciiCV('Test Description');
      const amount = uintCV(5000);
      const milestones = listCV([stringAsciiCV('Milestone 1')]);
      const milestoneAmounts = listCV([uintCV(5000)]);
      
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'submit-proposal',
        functionArgs: [title, description, amount, milestones, milestoneAmounts],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      expect(receipt.success).toBe(false);
      expect(receipt.error).toEqual('ERR-INSUFFICIENT-BALANCE');
    });
  });
  
  describe('Voting System', () => {
    beforeEach(async () => {
      // Setup a proposal and mint tokens for testing
      await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'mint-governance-tokens',
        functionArgs: [uintCV(2000), principalCV(DEPLOYER_ADDRESS)],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'submit-proposal',
        functionArgs: [
          stringAsciiCV('Test Proposal'),
          stringAsciiCV('Description'),
          uintCV(5000),
          listCV([stringAsciiCV('Milestone 1')]),
          listCV([uintCV(5000)])
        ],
        senderAddress: DEPLOYER_ADDRESS,
      });
    });
    
    it('should cast vote successfully', async () => {
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'vote-on-proposal',
        functionArgs: [uintCV(1), trueCV()],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      expect(receipt.success).toBe(true);
      
      // Verify vote was recorded
      const voteReceipt = await client.callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-vote',
        functionArgs: [uintCV(1), principalCV(DEPLOYER_ADDRESS)],
      });
      
      expect(voteReceipt.value.vote).toBe(true);
    });
    
    it('should prevent double voting', async () => {
      // First vote
      await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'vote-on-proposal',
        functionArgs: [uintCV(1), trueCV()],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      // Second vote attempt
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'vote-on-proposal',
        functionArgs: [uintCV(1), trueCV()],
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      expect(receipt.success).toBe(false);
      expect(receipt.error).toEqual('ERR-ALREADY-VOTED');
    });
  });
  
  describe('Milestone Management', () => {
    beforeEach(async () => {
      // Setup proposal with milestones and fund treasury
      await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'fund-treasury',
        functionArgs: [],
        senderAddress: DEPLOYER_ADDRESS,
        amount: 10000, // STX amount
      });
      
      await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'submit-proposal',
        functionArgs: [
          stringAsciiCV('Test Proposal'),
          stringAsciiCV('Description'),
          uintCV(5000),
          listCV([stringAsciiCV('Milestone 1'), stringAsciiCV('Milestone 2')]),
          listCV([uintCV(2500), uintCV(2500)])
        ],
        senderAddress: DEPLOYER_ADDRESS,
      });
    });
    
    it('should complete milestone successfully', async () => {
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'complete-milestone',
        functionArgs: [uintCV(1), uintCV(0)], // First milestone
        senderAddress: DEPLOYER_ADDRESS,
      });
      
      expect(receipt.success).toBe(true);
      
      // Verify treasury balance was reduced
      const balanceReceipt = await client.callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-treasury-balance',
        functionArgs: [],
      });
      
      expect(balanceReceipt.value).toEqual(uintCV(7500)); // 10000 - 2500
    });
    
    it('should fail milestone completion from non-creator', async () => {
      const nonCreator = 'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ';
      
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'complete-milestone',
        functionArgs: [uintCV(1), uintCV(0)],
        senderAddress: nonCreator,
      });
      
      expect(receipt.success).toBe(false);
      expect(receipt.error).toEqual('ERR-NOT-AUTHORIZED');
    });
  });
  
  describe('Treasury Management', () => {
    it('should fund treasury successfully', async () => {
      const fundAmount = 5000;
      
      const receipt = await client.callContract({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'fund-treasury',
        functionArgs: [],
        senderAddress: DEPLOYER_ADDRESS,
        amount: fundAmount,
      });
      
      expect(receipt.success).toBe(true);
      
      // Verify treasury balance
      const balanceReceipt = await client.callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-treasury-balance',
        functionArgs: [],
      });
      
      expect(balanceReceipt.value).toEqual(uintCV(fundAmount));
    });
  });
});
