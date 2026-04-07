// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ERC721 {
    function transferFrom(address from, address to, uint amount) external returns (bool);
}

contract LettuceMarket {

    ERC721 public yodaToken;

    uint public nextId;

    constructor(address _yodaToken) {
        yodaToken = ERC721(_yodaToken);
    }

    struct Lettuce {
        uint id;
        address seller;
        uint pricePerUnit;
        uint quantity;
        string category;
        string quality;
    }

    mapping(uint => Lettuce) public lettuces;

    event LettuceListed(uint id, address seller, uint price, uint quantity);
    event LettucePurchased(uint id, address buyer, uint amount);

    function listLettuce(
        uint pricePerUnit,
        uint quantity,
        string memory category,
        string memory quality

    ) public {

        require(pricePerUnit > 0, "Price must be > 0");
        require(quantity > 0, "Quantity must be > 0");

        lettuces[nextId] = Lettuce({
            id: nextId,
            seller: msg.sender,
            pricePerUnit: pricePerUnit,
            quantity: quantity,
            category: category,
            quality: quality

        });

        emit LettuceListed(nextId, msg.sender, pricePerUnit, quantity);

        nextId++;
    }

    function buyLettuce(uint id, uint amount) public {
        Lettuce storage item = lettuces[id];

        require(item.quantity >= amount, "Not enough lettuce");

        uint finalAmount = amount;

        uint totalPrice = item.pricePerUnit * amount;

        if (amount >= 10) {
            totalPrice = (totalPrice * 80) / 100;
        }

        require(
            yodaToken.transferFrom(msg.sender, item.seller, totalPrice),
            "Payment failed"
        );

        require(item.quantity >= finalAmount, "Not enough stock for deal");
        item.quantity -= finalAmount;

        emit LettucePurchased(id, msg.sender, finalAmount);
    }

    function getLettuce(uint id) public view returns (Lettuce memory) {
        return lettuces[id];
    }
}