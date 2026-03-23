// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CampusToken.sol";

contract TokenFactory {
    struct TokenInfo {
        address tokenAddress;
        string name;
        string symbol;
        uint totalSupply;
        address creator;
        uint createdAt;
    }

    TokenInfo[] public allTokens;
    mapping(address => address[]) public creatorTokens;

    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint totalSupply,
        address indexed creator,
        uint createdAt
    );

    function createToken(
        string memory _name,
        string memory _symbol,
        uint _supply
    ) public {
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_symbol).length > 0, "Symbol required");
        require(bytes(_symbol).length <= 5, "Symbol max 5 chars");
        require(_supply > 0, "Supply must be greater than 0");

        CampusToken newToken = new CampusToken(_name, _symbol, _supply, msg.sender);

        allTokens.push(TokenInfo({
            tokenAddress: address(newToken),
            name: _name,
            symbol: _symbol,
            totalSupply: _supply,
            creator: msg.sender,
            createdAt: block.timestamp
        }));

        creatorTokens[msg.sender].push(address(newToken));

        emit TokenCreated(
            address(newToken),
            _name,
            _symbol,
            _supply,
            msg.sender,
            block.timestamp
        );
    }

    function getAllTokens() public view returns (TokenInfo[] memory) {
        return allTokens;
    }

    function getTokensByCreator(address _creator) public view returns (address[] memory) {
        return creatorTokens[_creator];
    }

    function getTokenCount() public view returns (uint) {
        return allTokens.length;
    }
}
