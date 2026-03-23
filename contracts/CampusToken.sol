// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CampusToken {
    string public name;
    string public symbol;
    uint public totalSupply;
    address public owner;

    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    event Transfer(address indexed from, address indexed to, uint amount);
    event Approval(address indexed owner, address indexed spender, uint amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint _supply,
        address _creator
    ) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        owner = _creator;
        balanceOf[_creator] = _supply;
        emit Transfer(address(0), _creator, _supply);
    }

    function transfer(address to, uint amount) public returns (bool) {
        require(to != address(0), "Cannot send to zero address");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint amount) public returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Allowance exceeded");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
