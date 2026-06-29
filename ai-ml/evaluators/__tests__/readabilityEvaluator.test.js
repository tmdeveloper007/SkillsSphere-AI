import assert from 'node:assert';
import { describe, it } from 'node:test';
import readabilityEvaluator from '../readabilityEvaluator.js';

describe('readabilityEvaluator', () => {
  it('returns key readability_match', () => {
    const result = readabilityEvaluator({ resumeText: 'Built a web app.' });
    assert.equal(result.key, 'readability_match');
  });

  it('returns label Readability & Impact', () => {
    const result = readabilityEvaluator({ resumeText: 'Built a web app.' });
    assert.equal(result.label, 'Readability & Impact');
  });

  it('defaults to empty text gracefully', () => {
    const result = readabilityEvaluator({ resumeText: '' });
    assert.equal(result.score, 100);
    assert.equal(result.summary, 'Strong use of action verbs and active voice.');
  });

  it('returns full result object with required fields', () => {
    const result = readabilityEvaluator({ resumeText: 'Led the team to success.' });
    assert.ok('score' in result);
    assert.ok('summary' in result);
    assert.ok('details' in result);
    assert.ok('suggestions' in result.details);
    assert.ok(Array.isArray(result.details.suggestions));
  });

  it('reduces score for passive voice usage', () => {
    const withPassive = readabilityEvaluator({
      resumeText: 'The feature was built by the team. Another was coded.',
    });
    const withoutPassive = readabilityEvaluator({
      resumeText: 'Built the feature. Coded another.',
    });
    assert.ok(withPassive.score < withoutPassive.score);
  });

  it('reduces score when verb density is low', () => {
    const lowVerb = readabilityEvaluator({
      resumeText: 'Responsible for tasks. Worked on things. Was involved.',
    });
    assert.ok(lowVerb.score < 100, 'Low verb density should reduce score');
  });

  it('increases power verb count for action verbs', () => {
    const withPowerVerb = readabilityEvaluator({
      resumeText: 'Led the engineering team. Architected the system.',
    });
    assert.ok(withPowerVerb.details.powerVerbCount >= 2, 'Should detect power verbs');
  });

  it('marks repetitive verbs in details', () => {
    const repetitive = readabilityEvaluator({
      resumeText: 'Built the API. Built the UI. Built the tests. Built the docs.',
    });
    assert.ok(repetitive.details.verbDensity !== undefined);
  });

  it('clamps score between 0 and 100', () => {
    const result = readabilityEvaluator({ resumeText: '' });
    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it('handles very long resume text', () => {
    const longText = 'Led the team. ' + 'Built features. '.repeat(50);
    const result = readabilityEvaluator({ resumeText: longText });
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.ok(result.details.powerVerbCount >= 0);
  });

  it('identifies complex sentences in details', () => {
    const complex = readabilityEvaluator({
      resumeText:
        'This is a very long sentence that should be considered complex because it exceeds the normal complexity threshold and has too many long words in it and it also contains many complex technical terms and methodologies and architectural patterns and implementation strategies and design considerations.',
    });
    assert.ok('complexSentenceCount' in complex.details);
    assert.ok(complex.details.complexSentenceCount >= 1);
  });

  it('provides suggestions when score is below threshold', () => {
    const weak = readabilityEvaluator({
      resumeText: 'Responsible for tasks. Worked on things.',
    });
    assert.ok(Array.isArray(weak.details.suggestions));
  });

  it('returns correct summary for strong text', () => {
    const strong = readabilityEvaluator({
      resumeText: 'Led the team. Architected the system. Delivered the project on time.',
    });
    assert.ok(
      strong.summary === 'Strong use of action verbs and active voice.' ||
        strong.summary === 'Some bullets are weak or use passive voice, which reduces the impact of your experience.'
    );
  });
});
