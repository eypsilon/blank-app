import type { UserConfig } from '@commitlint/types';
import { RuleConfigSeverity } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  formatter: '@commitlint/format',
  rules: {
    'scope-empty': [RuleConfigSeverity.Error, 'always'],
    'no-empty-brackets': [RuleConfigSeverity.Error, 'always'],
    'type-enum': [RuleConfigSeverity.Error, 'always', ['feat', 'fix', 'chore', 'ci', 'docs', 'test']],
  },
  plugins: [
    /**
     * As we are using scope-empty rule, we need this plugin to prevent () as scope which is not caught by scope-empty rule
     */
    {
      rules: {
        'no-empty-brackets': ({ header }) => {
          if (!header) {
            return [true];
          }

          const hasEmptyBrackets = header.includes('()');

          return [!hasEmptyBrackets, "header must not contain empty brackets '()'"];
        },
      },
    },
  ],
};

export default Configuration;
