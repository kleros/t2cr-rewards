<p align="center">
  <b style="font-size: 32px;">Rewards Withdraw Bot</b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
  <a href="https://github.com/prettier/prettier"><img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with Prettier"></a>
</p>

On the [Token² Curated List](tokens.kleros.io), users can contribute to dispute appeal fees to the side they believe is correct and get a chance to win rewards.

This bot is a convenience tool that withdraws those fee contributions and rewards to users so they don't have to do it themselves.

## Usage

The bot needs to query every round of the requests a user contributed to. As the TCRs grow, this could result in too many requests being sent to the node and result in rate limiting.
To avoid this we use local storage to not query blocks already checked.

To clear the cache, use `yarn clear`.