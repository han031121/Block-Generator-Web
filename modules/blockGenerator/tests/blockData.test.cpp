#include "blockData.hpp"

#include <cstdlib>
#include <iostream>
#include <string>
#include <unordered_set>

namespace
{
void require(bool condition, const std::string& message)
{
    if (condition)
        return;

    std::cerr << "Test failed: " << message << std::endl;
    std::exit(1);
}

int countCubes(const blockData& data)
{
    int count = 0;

    for (int r = 0; r < data.getMaxRow(); r++)
    {
        for (int c = 0; c < data.getMaxCol(); c++)
            count += data.getHeightData(r, c);
    }

    return count;
}

void testPackedStateKey()
{
    BlockStateKey key;
    BlockStateKey copy;

    key.setHeight(0, 13);
    key.setHeight(1, 7);
    copy.setHeight(0, 13);
    copy.setHeight(1, 7);

    require(key.getHeight(0) == 13, "packed state key lost an even cell height");
    require(key.getHeight(1) == 7, "packed state key lost an odd cell height");
    require(key == copy, "equivalent packed state keys differ");
    require(
        BlockStateKeyHash{}(key) == BlockStateKeyHash{}(copy),
        "equivalent packed state keys have different hashes"
    );

    key.setHeight(0, 0);
    key.setHeight(1, 0);
    require(key == BlockStateKey{}, "packed state key did not restore its empty state");
    require(BlockStateKeyHash{}(key) == 0, "empty packed state key hash was not restored");
}

void expectUniquePatterns(
    int block_count_min,
    int block_count_max,
    int max_r,
    int max_c,
    int max_h,
    int expected_pattern_count
)
{
    blockData data(
        block_count_min,
        block_count_max,
        max_r,
        max_c,
        max_h,
        0,
        false
    );
    std::unordered_set<std::string> identifiers;

    for (int i = 0; i < expected_pattern_count; i++)
    {
        data.generateBlock();

        require(data.isGenerated(), "a reachable unique pattern was not generated");
        require(
            countCubes(data) == data.getBlockCount(),
            "the generated cube count differs from the target count"
        );
        require(
            identifiers.insert(data.getIdentify()).second,
            "a duplicate final pattern was generated"
        );
    }

    data.generateBlock();
    require(!data.isGenerated(), "generation did not stop after all unique patterns were exhausted");
}

void testDuplicateModeRemainsAvailable()
{
    blockData data(1, 1, 1, 1, 1, 0, true);

    data.generateBlock();
    require(data.isGenerated(), "duplicate mode failed on the first generation");
    std::string first_identifier = data.getIdentify();

    data.generateBlock();
    require(data.isGenerated(), "duplicate mode failed on the second generation");
    require(
        data.getIdentify() == first_identifier,
        "duplicate mode did not regenerate the only available pattern"
    );
}

void expectDuplicateGeneration(
    int block_count,
    int max_r,
    int max_c,
    int max_h,
    double density,
    int generation_count
)
{
    blockData data(
        block_count,
        block_count,
        max_r,
        max_c,
        max_h,
        density,
        true
    );

    for (int i = 0; i < generation_count; i++)
    {
        data.generateBlock();

        require(data.isGenerated(), "duplicate mode failed to generate a reachable pattern");
        require(
            countCubes(data) == block_count,
            "duplicate mode generated a pattern with an incorrect cube count"
        );
    }
}

}

int main()
{
    testPackedStateKey();
    expectUniquePatterns(1, 1, 2, 2, 1, 1);
    expectUniquePatterns(2, 2, 1, 3, 1, 1);
    expectUniquePatterns(2, 2, 2, 2, 1, 2);
    expectUniquePatterns(1, 2, 1, 2, 1, 2);
    expectUniquePatterns(7, 7, 2, 2, 2, 3);
    expectUniquePatterns(6, 6, 2, 2, 2, 6);
    expectUniquePatterns(8, 8, 2, 2, 2, 1);
    testDuplicateModeRemainsAvailable();
    expectDuplicateGeneration(13, 1, 1, 13, 0, 10);
    expectDuplicateGeneration(8, 3, 3, 3, 100, 100);

    std::cout << "All blockData tests passed." << std::endl;
    return 0;
}
